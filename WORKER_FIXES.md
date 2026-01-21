# Worker Issues Fixed

## Problem
Invalid CSV files were being processed but no issues or error messages were created. Users uploaded bad data and the system silently did nothing.

## Root Cause
The worker.py file had the same class name typo that was in main.py:
- Line 14: Imported lowercase `application` instead of uppercase `Application`
- Lines 88, 195, 232, 451: Used lowercase `application` as type hint and in `db.get()` calls

This caused the worker to crash silently when trying to fetch the application from the database.

## Fixes Applied

### 1. Fixed Import Statement (Line 14)
```python
# WRONG
from models import application, RawRow, Issue, IssueResolution, FinalContact

# FIXED
from models import Application, RawRow, Issue, IssueResolution, FinalContact
```

### 2. Fixed Function Signatures
```python
# WRONG
def set_job_failed(db: Session, application: application, message: str):

# FIXED
def set_job_failed(db: Session, application: Application, message: str):
```

### 3. Fixed Database Queries
```python
# WRONG
application = db.get(application, application_id)

# FIXED
application = db.get(Application, application_id)
```

**Affected lines:** 232, 451

## How the Worker Works

The worker is responsible for:
1. **Polling SQS queue** for new applications to process
2. **Downloading CSV file** from S3
3. **Parsing CSV** and validating each row
4. **Detecting issues:**
   - Missing email
   - Invalid email format
   - Missing first name
   - Missing last name
   - Missing company
   - Duplicate emails with different identities
5. **Creating Issue records** for user review
6. **Updating application status:**
   - PROCESSING (currently working)
   - NEEDS_REVIEW (issues found)
   - COMPLETED (all resolved)
   - FAILED (uncaught error)

## Why Issues Weren't Created

When you uploaded invalid CSV files:
1. Worker was supposed to process them
2. But it crashed when trying to fetch the application
3. The crash happened before any validation logic ran
4. SQS message wasn't deleted (due to error)
5. Message went back into queue for retry
6. But the application never got created/updated because the worker couldn't find it

## What Now Works

After the fixes:

1. **Invalid files are detected:**
   - Missing columns (email, etc.)
   - Malformed CSV rows
   - Invalid email formats
   - Missing required fields

2. **Issues are created for each problem:**
   - Each issue appears in the application detail view
   - Users can see exactly what's wrong
   - Users can decide what to do about it

3. **Application status updates correctly:**
   - PROCESSING → NEEDS_REVIEW (when issues found)
   - PROCESSING → COMPLETED (when no issues)
   - PROCESSING → FAILED (when uncaught error)

## Testing the Fix

1. Restart Docker:
   ```bash
   docker compose down
   docker compose up --build
   ```

2. Upload a CSV with invalid data:
   - Missing email column
   - Missing first name
   - Invalid email format (e.g., "notanemail")
   - Duplicate emails with different names

3. Expected behavior:
   - Application status → PROCESSING (for a few seconds)
   - Application status → NEEDS_REVIEW (once processing done)
   - Application status shows number of conflicted rows
   - Click into application detail to see the issues list
   - Each issue shows the problem and affected rows

## Files Fixed

| File | Changes |
|------|---------|
| `backend/worker.py` | Fixed 4 instances of lowercase `application` to uppercase `Application` |

## Related Fixes (from previous work)

| File | Changes |
|------|---------|
| `backend/main.py` | Fixed 3 instances of lowercase `application` in database queries |
| `backend/config.py` | Added default value for JWT_SECRET |

## Summary

The system now correctly:
- Processes CSV files
- Detects validation errors
- Creates Issue records
- Shows errors to users
- Allows users to resolve or investigate problems

Try uploading an invalid CSV and check if issues appear!
