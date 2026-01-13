import json
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from database import Base, engine, get_db
from models import User, Job, Issue, IssueResolution, RawRow, FinalContact
from constants import IssueStatus, JobStatus, IssueType
from auth import hash_password, verify_password, create_token, get_current_user
from schemas import RegisterIn, TokenOut, JobOut, ResolveIssueIn
from services.storage import upload_bytes
from services.queue import publish_job
from config import settings
from fastapi.middleware.cors import CORSMiddleware

Base.metadata.create_all(bind=engine)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/auth/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(409, "Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_token(user.id)}

@app.post("/auth/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses "username" field; we'll treat it as email
    user = db.query(User).filter(User.email == form.username).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    return {"access_token": create_token(user.id)}


@app.post("/jobs", response_model=JobOut)
async def upload_job(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 5MB)")

    job = Job(user_id=user.id, status=JobStatus.PENDING, original_filename=file.filename)
    db.add(job)
    db.commit()
    db.refresh(job)

    file_key = f"uploads/u{user.id}/job-{job.id}.csv"
    upload_bytes(content, file_key)

    job.file_key = file_key
    db.commit()

    publish_job(job.id, file_key)

    return JobOut(
        id=job.id,
        status=job.status,
        total_rows=job.total_rows,
        valid_rows=job.valid_rows,
        invalid_rows=job.invalid_rows,
        conflict_count=job.conflict_count,
        error_message=job.error_message,
    )

@app.get("/jobs", response_model=list[JobOut])
def list_jobs(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    jobs = db.query(Job).filter(Job.user_id == user.id).order_by(Job.id.desc()).all()
    return [JobOut(
        id=j.id, status=j.status,
        total_rows=j.total_rows, valid_rows=j.valid_rows,
        invalid_rows=j.invalid_rows, conflict_count=j.conflict_count,
        error_message=j.error_message
    ) for j in jobs]

@app.get("/jobs/{job_id}")
def job_detail(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.get(Job, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404, "Job not found")

    issues = db.query(Issue).filter(Issue.job_id == job_id).all()
    return {
        "job": {
            "id": job.id,
            "status": job.status,
            "file_key": job.file_key,
            "total_rows": job.total_rows,
            "valid_rows": job.valid_rows,
            "invalid_rows": job.invalid_rows,
            "conflict_count": job.conflict_count,
            "error_message": job.error_message,
        },
        "issues": [
            {"id": i.id, "type": i.type, "status": i.status, "key": i.key, "payload": json.loads(i.payload_json)}
            for i in issues
        ]
    }
    
@app.get("/jobs/{job_id}/issues")
def list_job_issues(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.get(Job, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404, "Job not found")

    issues = db.query(Issue).filter(Issue.job_id == job_id).order_by(Issue.id.asc()).all()
    return [
        {
            "id": i.id,
            "type": i.type,
            "status": i.status,
            "key": i.key,
            "payload": json.loads(i.payload_json),
        }
        for i in issues
]
    
@app.post("/jobs/{job_id}/finalize")
def finalize_job(job_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    job = db.get(Job, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404, "Job not found")

    open_issues = db.query(Issue).filter(Issue.job_id == job_id, Issue.status == IssueStatus.OPEN).count()
    if open_issues > 0:
        raise HTTPException(409, "Cannot finalize: unresolved issues remain")

    # Clear any previous final contacts (idempotent finalize)
    db.query(FinalContact).filter(FinalContact.job_id == job_id).delete()
    db.commit()

    # Map resolved issues: email -> chosen_row_id
    resolutions = (
        db.query(Issue, IssueResolution)
        .join(IssueResolution, IssueResolution.issue_id == Issue.id)
        .filter(Issue.job_id == job_id)
        .all()
    )
    chosen_by_email = {}
    for issue, res in resolutions:
        if issue.type == IssueType.DUPLICATE_EMAIL:
            data = json.loads(res.resolution_json)
            chosen_by_email[issue.key] = int(data["chosen_row_id"])

    # Build contacts from valid rows
    rows = db.query(RawRow).filter(RawRow.job_id == job_id, RawRow.is_valid == True).all()  # noqa: E712
    by_email = {}
    for r in rows:
        if r.normalized_email:
            by_email.setdefault(r.normalized_email, []).append(r)

    for email, rlist in by_email.items():
        # If there was a conflict and we have a chosen row, use it
        if email in chosen_by_email:
            chosen_row = db.get(RawRow, chosen_by_email[email])
            if not chosen_row:
                continue
            data = json.loads(chosen_row.data_json)
        else:
            # No issue for this email: pick first valid row
            data = json.loads(rlist[0].data_json)

        db.add(FinalContact(
            job_id=job_id,
            email=email,
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            company=data.get("company"),
        ))

    job.status = JobStatus.COMPLETED
    db.commit()

    return {"ok": True, "job_id": job.id, "status": job.status}
