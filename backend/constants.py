from enum import StrEnum

class JobStatus(StrEnum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class IssueType(StrEnum):
    DUPLICATE_EMAIL = "DUPLICATE_EMAIL"
    CONFLICTING_COMPANY = "CONFLICTING_COMPANY"

class IssueStatus(StrEnum):
    OPEN = "OPEN"
    RESOLVED = "RESOLVED"
