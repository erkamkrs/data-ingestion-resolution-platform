import json
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm
from database import Base, engine, get_db
from models import User, Application, Issue, IssueResolution, RawRow, FinalContact
from constants import IssueStatus, ApplicationStatus, IssueType
from auth import hash_password, verify_password, create_token, get_current_user
from schemas import RegisterIn, TokenOut, ApplicationOut, ResolveIssueIn
from services.storage import upload_bytes
from services.queue import publish_job
from config import settings
from fastapi.middleware.cors import CORSMiddleware
from models import Issue, IssueResolution, RawRow, Application
from constants import IssueStatus
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


@app.post("/applications", response_model=ApplicationOut)
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

    application = Application(user_id=user.id, status=ApplicationStatus.PENDING, original_filename=file.filename)
    db.add(application)
    db.commit()
    db.refresh(application)

    file_key = f"uploads/u{user.id}/application-{application.id}.csv"
    upload_bytes(content, file_key)

    application.file_key = file_key
    db.commit()

    publish_job(application.id, file_key)

    return ApplicationOut(
        id=application.id,
        status=application.status,
        total_rows=application.total_rows,
        valid_rows=application.valid_rows,
        invalid_rows=application.invalid_rows,
        conflict_count=application.conflict_count,
        error_message=application.error_message,
        original_filename=application.original_filename,
    )

@app.get("/applications", response_model=list[ApplicationOut])
def list_applications(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    applications = db.query(Application).filter(Application.user_id == user.id).order_by(Application.id.desc()).all()
    return [ApplicationOut(
        id=j.id, status=j.status,
        total_rows=j.total_rows, valid_rows=j.valid_rows,
        invalid_rows=j.invalid_rows, conflict_count=j.conflict_count,
        error_message=j.error_message,
        original_filename=j.original_filename
    ) for j in applications]

@app.get("/applications/{application_id}")
def job_detail(application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = db.get(Application, application_id)
    if not application or application.user_id != user.id:
        raise HTTPException(404, "application not found")

    issues = db.query(Issue).filter(Issue.application_id == application_id).all()
    return {
        "application": {
            "id": application.id,
            "status": application.status,
            "file_key": application.file_key,
            "total_rows": application.total_rows,
            "valid_rows": application.valid_rows,
            "invalid_rows": application.invalid_rows,
            "conflict_count": application.conflict_count,
            "error_message": application.error_message,
        },
        "issues": [
            {"id": i.id, "type": i.type, "status": i.status, "key": i.key, "payload": json.loads(i.payload_json)}
            for i in issues
        ]
    }
    
@app.get("/applications/{application_id}/issues")
def list_job_issues(application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = db.get(Application, application_id)
    if not application or application.user_id != user.id:
        raise HTTPException(404, "application not found")

    issues = db.query(Issue).filter(Issue.application_id == application_id).order_by(Issue.id.asc()).all()

    # build resolution map: issue_id -> chosen_row_id
    res_rows = db.query(IssueResolution).filter(IssueResolution.issue_id.in_([i.id for i in issues])).all()
    chosen_by_issue = {}
    for r in res_rows:
        data = json.loads(r.resolution_json)
        chosen_by_issue[r.issue_id] = data.get("chosen_row_id")

    out = []
    for i in issues:
        out.append({
            "id": i.id,
            "type": i.type,
            "status": i.status,
            "key": i.key,
            "payload": json.loads(i.payload_json),
            "resolution": {
                "chosen_row_id": chosen_by_issue.get(i.id)
            } if i.status == IssueStatus.RESOLVED else None
        })
    return out

    
@app.post("/applications/{application_id}/finalize")
def finalize_job(application_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    application = db.get(Application, application_id)
    if not application or application.user_id != user.id:
        raise HTTPException(404, "application not found")

    open_issues = db.query(Issue).filter(Issue.application_id == application_id, Issue.status == IssueStatus.OPEN).count()
    if open_issues > 0:
        raise HTTPException(409, "Cannot finalize: unresolved issues remain")

    # Clear any previous final contacts (idempotent finalize)
    db.query(FinalContact).filter(FinalContact.application_id == application_id).delete()
    db.commit()

    # Map resolved issues: email -> chosen_row_id
    resolutions = (
        db.query(Issue, IssueResolution)
        .join(IssueResolution, IssueResolution.issue_id == Issue.id)
        .filter(Issue.application_id == application_id)
        .all()
    )
    chosen_by_email = {}
    for issue, res in resolutions:
        if issue.type == IssueType.DUPLICATE_EMAIL:
            data = json.loads(res.resolution_json)
            chosen_by_email[issue.key] = int(data["chosen_row_id"])

    # Build contacts from valid rows
    rows = db.query(RawRow).filter(RawRow.application_id == application_id, RawRow.is_valid == True).all()  # noqa: E712
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
            application_id=application_id,
            email=email,
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            company=data.get("company"),
        ))

    application.status = ApplicationStatus.COMPLETED
    db.commit()

    return {"ok": True, "application_id": application.id, "status": application.status}

@app.post("/issues/{issue_id}/resolve")
def resolve_issue(
    issue_id: int,
    body: ResolveIssueIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    issue = db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")

    application = db.get(Application, issue.application_id)
    if not application or application.user_id != user.id:
        raise HTTPException(status_code=404, detail="Issue not found")

    if issue.status == IssueStatus.RESOLVED:
        raise HTTPException(status_code=409, detail="Issue already resolved")

    # Handle different resolution strategies based on issue type and action
    
    if body.action == "skip":
        # User decided to skip/discard this row
        # Mark the row as invalid so it won't appear in final contacts
        if body.row_id:
            row = db.get(RawRow, body.row_id)
            if row and row.application_id == application.id:
                row.is_valid = False
                db.commit()
        
        # Record the resolution
        payload = {"action": "skip", "row_id": body.row_id}
        existing = db.query(IssueResolution).filter(IssueResolution.issue_id == issue.id).one_or_none()
        if existing:
            existing.resolution_json = json.dumps(payload)
        else:
            db.add(IssueResolution(issue_id=issue.id, resolution_json=json.dumps(payload)))
        issue.status = IssueStatus.RESOLVED
        db.commit()
        return {"ok": True, "issue_id": issue.id, "status": issue.status}
    
    elif body.action == "edit":
        # User provided corrected data for a row
        if not body.row_id or not body.updated_data:
            raise HTTPException(status_code=400, detail="edit action requires row_id and updated_data")
        
        row = db.get(RawRow, body.row_id)
        if not row or row.application_id != application.id:
            raise HTTPException(status_code=400, detail="row_id does not belong to this application")
        
        # Validate and update the row with corrected data
        # Only allow updating: email, first_name, last_name, company
        current_data = json.loads(row.data_json)
        
        # Update allowed fields
        if "email" in body.updated_data:
            current_data["email"] = body.updated_data["email"].strip() if body.updated_data["email"] else None
        if "first_name" in body.updated_data:
            current_data["first_name"] = body.updated_data["first_name"].strip() if body.updated_data["first_name"] else None
        if "last_name" in body.updated_data:
            current_data["last_name"] = body.updated_data["last_name"].strip() if body.updated_data["last_name"] else None
        if "company" in body.updated_data:
            current_data["company"] = body.updated_data["company"].strip() if body.updated_data["company"] else None
        
        # Re-validate the email
        from worker import normalize_email, is_valid_email_format
        updated_email = current_data.get("email")
        normalized_email = normalize_email(updated_email) if updated_email else None
        
        # Update the row
        row.data_json = json.dumps(current_data)
        row.normalized_email = normalized_email if normalized_email and is_valid_email_format(normalized_email) else None
        row.is_valid = True
        db.commit()
        
        # Record the resolution
        payload = {"action": "edit", "row_id": body.row_id, "updated_data": body.updated_data}
        existing = db.query(IssueResolution).filter(IssueResolution.issue_id == issue.id).one_or_none()
        if existing:
            existing.resolution_json = json.dumps(payload)
        else:
            db.add(IssueResolution(issue_id=issue.id, resolution_json=json.dumps(payload)))
        issue.status = IssueStatus.RESOLVED
        db.commit()
        return {"ok": True, "issue_id": issue.id, "status": issue.status}
    
    elif body.action == "choose":
        # Original logic: user chose one row from duplicates
        if not body.chosen_row_id:
            raise HTTPException(status_code=400, detail="choose action requires chosen_row_id")
        
        # Validate chosen row belongs to the same application
        rr = db.get(RawRow, body.chosen_row_id)
        if not rr or rr.application_id != application.id:
            raise HTTPException(status_code=400, detail="chosen_row_id does not belong to this application")

        # Record the resolution
        payload = {"action": body.action, "chosen_row_id": body.chosen_row_id}
        existing = db.query(IssueResolution).filter(IssueResolution.issue_id == issue.id).one_or_none()
        if existing:
            existing.resolution_json = json.dumps(payload)
        else:
            db.add(IssueResolution(issue_id=issue.id, resolution_json=json.dumps(payload)))
        issue.status = IssueStatus.RESOLVED
        db.commit()
        return {"ok": True, "issue_id": issue.id, "status": issue.status}
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {body.action}")

