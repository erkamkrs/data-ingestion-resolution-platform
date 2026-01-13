from sqlalchemy import (
    Column, Integer, String, ForeignKey, DateTime, Boolean, Text,
    UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base
from constants import JobStatus, IssueType, IssueStatus

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

class Job(Base):
    __tablename__ = "jobs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default=JobStatus.PENDING)

    file_key = Column(String(1024), nullable=True)
    original_filename = Column(String(255), nullable=True)

    total_rows = Column(Integer, default=0, nullable=False)
    valid_rows = Column(Integer, default=0, nullable=False)
    invalid_rows = Column(Integer, default=0, nullable=False)
    conflict_count = Column(Integer, default=0, nullable=False)

    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

class RawRow(Base):
    __tablename__ = "raw_rows"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    data_json = Column(Text, nullable=False)
    normalized_email = Column(String(255), nullable=True, index=True)

    is_valid = Column(Boolean, nullable=False, default=True)
    validation_errors_json = Column(Text, nullable=True)

class Issue(Base):
    __tablename__ = "issues"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    type = Column(String(64), nullable=False, default=IssueType.DUPLICATE_EMAIL)
    status = Column(String(32), nullable=False, default=IssueStatus.OPEN)

    key = Column(String(255), nullable=False)      # normalized email
    payload_json = Column(Text, nullable=False)    # candidates

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("job_id", "type", "key", name="uq_issue_job_type_key"),
    )

class IssueResolution(Base):
    __tablename__ = "issue_resolutions"
    id = Column(Integer, primary_key=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False, unique=True)
    resolution_json = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

class FinalContact(Base):
    __tablename__ = "final_contacts"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    email = Column(String(255), nullable=False)
    first_name = Column(String(255), nullable=True)
    last_name = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("job_id", "email", name="uq_final_job_email"),
    )
