# backend/worker.py
import csv
import io
import json
import time
import traceback
from typing import Dict, List, Tuple, Set

from sqlalchemy.orm import Session

from database import SessionLocal
from models import Job, RawRow, Issue, FinalContact
from constants import JobStatus, IssueType, IssueStatus
from services.storage import download_bytes
from services.queue import poll_messages, delete_message


def normalize_email(email: str | None) -> str | None:
    if not email:
        return None
    e = email.strip().lower()
    return e or None


def identity_signature(row: dict) -> Tuple[str, str, str]:
    """What defines a 'different identity' for same email."""
    fn = (row.get("first_name") or "").strip().lower()
    ln = (row.get("last_name") or "").strip().lower()
    co = (row.get("company") or "").strip().lower()
    return (fn, ln, co)


def safe_json(obj) -> str:
    return json.dumps(obj, ensure_ascii=False)


def set_job_failed(db: Session, job: Job, message: str):
    job.status = JobStatus.FAILED
    job.error_message = message[:5000]
    db.commit()


def upsert_duplicate_issue(
    db: Session,
    job_id: int,
    email: str,
    candidate_rows: List[dict],
):
    """
    Idempotent insert:
    - issues table has unique(job_id, type, key)
    - if already exists, update payload (optional) and keep status as-is if RESOLVED
    """
    existing = (
        db.query(Issue)
        .filter(Issue.job_id == job_id, Issue.type == IssueType.DUPLICATE_EMAIL, Issue.key == email)
        .one_or_none()
    )
    payload = {
        "email": email,
        "candidates": candidate_rows,  # each should include row_id + row_number + fields
    }

    if existing:
        # Only update payload; don't reopen automatically if already resolved
        existing.payload_json = safe_json(payload)
        db.add(existing)
        db.commit()
        return existing

    issue = Issue(
        job_id=job_id,
        type=IssueType.DUPLICATE_EMAIL,
        status=IssueStatus.OPEN,
        key=email,
        payload_json=safe_json(payload),
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


def auto_finalize_if_no_issues(db: Session, job: Job):
    """
    Simple auto-finalize:
    - For each email with multiple valid rows but same identity, pick first
    - For conflict emails, there should be an Issue -> so we don't auto-finalize those
    """
    open_issues = db.query(Issue).filter(Issue.job_id == job.id, Issue.status == IssueStatus.OPEN).count()
    if open_issues > 0:
        return False

    # Build contacts from valid rows
    rows = db.query(RawRow).filter(RawRow.job_id == job.id, RawRow.is_valid == True).all()  # noqa: E712
    # group by normalized_email
    by_email: Dict[str, List[RawRow]] = {}
    for r in rows:
        if not r.normalized_email:
            continue
        by_email.setdefault(r.normalized_email, []).append(r)

    for email, rlist in by_email.items():
        # pick first row's data_json
        data = json.loads(rlist[0].data_json)
        fc = FinalContact(
            job_id=job.id,
            email=email,
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            company=data.get("company"),
        )
        db.add(fc)

    job.status = JobStatus.COMPLETED
    db.commit()
    return True


def process_job(db: Session, job_id: int, file_key: str):
    job = db.get(Job, job_id)
    if not job:
        return

    # Idempotency: if completed, no-op
    if job.status == JobStatus.COMPLETED:
        return

    job.status = JobStatus.PROCESSING
    job.error_message = None
    db.commit()

    # Optional: clear previous staging rows for clean reprocessing
    db.query(RawRow).filter(RawRow.job_id == job_id).delete()
    db.query(FinalContact).filter(FinalContact.job_id == job_id).delete()
    # Do not delete issues/resolutions; we upsert issues
    db.commit()

    file_bytes = download_bytes(file_key)
    text = file_bytes.decode("utf-8-sig", errors="replace")
    f = io.StringIO(text)

    reader = csv.DictReader(f)
    total = 0
    valid = 0
    invalid = 0

    # Track identity signatures for duplicates
    email_to_sigs: Dict[str, Set[Tuple[str, str, str]]] = {}
    email_to_row_ids: Dict[str, List[int]] = {}

    for row_number, row in enumerate(reader, start=2):  # start=2 (header is line 1)
        total += 1

        email = normalize_email(row.get("email"))
        errors = []

        if not email:
            errors.append("missing_email")
        else:
            # basic format check; keep simple here (can improve later)
            if "@" not in email or "." not in email.split("@")[-1]:
                errors.append("invalid_email_format")

        is_valid = len(errors) == 0
        if is_valid:
            valid += 1
        else:
            invalid += 1

        raw = RawRow(
            job_id=job_id,
            row_number=row_number,
            data_json=safe_json({
                "email": email,
                "first_name": row.get("first_name"),
                "last_name": row.get("last_name"),
                "company": row.get("company"),
            }),
            normalized_email=email,
            is_valid=is_valid,
            validation_errors_json=safe_json(errors) if errors else None,
        )
        db.add(raw)
        db.flush()   # assigns raw.id without committing


        if is_valid and email:
            sig = identity_signature(row)
            email_to_sigs.setdefault(email, set()).add(sig)
            email_to_row_ids.setdefault(email, []).append(raw.id)

    # Create issues for conflict emails: >1 distinct identity signatures
    conflict_count = 0
    for email, sigs in email_to_sigs.items():
        if len(sigs) > 1:
            conflict_count += 1
            # Build candidate rows payload (show row snapshots)
            candidate_rows = []
            raw_rows = db.query(RawRow).filter(RawRow.id.in_(email_to_row_ids[email])).all()
            for rr in raw_rows:
                candidate_rows.append({
                    "raw_row_id": rr.id,
                    "row_number": rr.row_number,
                    "data": json.loads(rr.data_json),
                })

            upsert_duplicate_issue(db, job_id=job_id, email=email, candidate_rows=candidate_rows)

    # Update job stats + status
    job.total_rows = total
    job.valid_rows = valid
    job.invalid_rows = invalid
    job.conflict_count = conflict_count

    # Determine status
    open_issues = db.query(Issue).filter(Issue.job_id == job_id, Issue.status == IssueStatus.OPEN).count()
    if open_issues > 0:
        job.status = JobStatus.NEEDS_REVIEW
        db.commit()
        return

    # No issues -> auto-finalize
    db.commit()
    auto_finalize_if_no_issues(db, job)


def main():
    print("Worker started. Polling SQS...")
    while True:
        try:
            messages, queue_url = poll_messages(max_messages=1, wait_seconds=10)
            if not messages:
                continue

            for m in messages:
                receipt = m["ReceiptHandle"]
                try:
                    body = json.loads(m["Body"])
                    job_id = int(body["job_id"])
                    file_key = body["file_key"]

                    db = SessionLocal()
                    try:
                        process_job(db, job_id, file_key)
                    finally:
                        db.close()

                    delete_message(queue_url, receipt)
                    print(f"Processed job {job_id} successfully.")
                except Exception as e:
                    # Don't delete message -> SQS will retry
                    print("Error processing message:", str(e))
                    traceback.print_exc()

                    # Best-effort: mark job failed (if we can)
                    try:
                        db = SessionLocal()
                        try:
                            job_id = int(json.loads(m["Body"]).get("job_id", 0))
                            job = db.get(Job, job_id)
                            if job and job.status != JobStatus.COMPLETED:
                                set_job_failed(db, job, f"{e}\n{traceback.format_exc()}")
                        finally:
                            db.close()
                    except Exception:
                        pass

            time.sleep(0.1)
        except Exception as outer:
            print("Worker loop error:", str(outer))
            traceback.print_exc()
            time.sleep(2)


if __name__ == "__main__":
    main()
