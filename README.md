# Data Ingestion Resolution Platform

A full-stack web application for importing, validating, and adjusting contact data from CSV files.

## Overview

This project solves a real-world problem: importing CSV data is messy. The same email address might appear multiple times with different names, some emails might be invalid, and required fields might be missing.

Rather than blindly accepting or rejecting data, this application implements a human-in-the-loop validation system that:
- Automatically processes CSV uploads
- Detects duplicate emails and data conflicts
- Presents conflicts to users for review
- Generates a clean, deduplicated contact list

## Features

- CSV File Upload - Import contact data with email, first name, last name, and company
- Smart Validation - Automatic validation of email format and data quality
- Duplicate Detection - Identifies conflicts when the same email has different identity information
- Issue Resolution - User interface to resolve data conflicts
- Clean Output - Generates deduplicated contact list after review
- User Authentication - Secure login and registration system
- Real-time Updates - Monitor processing progress in real-time

## Technology Stack

Frontend:
- React 18 with TypeScript
- Vite build tool
- Modern CSS

Backend:
- Python FastAPI
- SQLAlchemy ORM
- PostgreSQL database
- JWT authentication
- AWS S3 for file storage (LocalStack for local development)
- AWS SQS for async processing (LocalStack for local development)

Infrastructure:
- Docker and Docker Compose
- LocalStack for local AWS service emulation

## Architecture

The system uses an event-driven, asynchronous architecture:

```
Frontend (React)
    |
    v
API Server (FastAPI)
    |
    +---> PostgreSQL Database
    |
    +---> S3 File Storage
    |
    +---> SQS Message Queue
            |
            v
        Background Worker (Python)
            - Parse CSV
            - Validate data
            - Detect duplicates
            - Create issues for review
```

Key design decisions:
- File upload and processing are decoupled. Users get instant feedback while processing happens in the background.
- All processing results are stored with complete audit trail.
- Human review is required for data conflicts. The system detects problems, but users decide the resolution.

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Git

Optional (for local development without Docker):
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)

### Quick Start with Docker

1. Clone the repository:
   ```
   git clone <repository-url>
   cd data-ingestion-tool
   ```

2. Start all services:
   ```
   docker-compose up
   ```

3. Wait for services to initialize (about 30 seconds)

4. Open your browser:
   - Frontend: http://localhost:5173
   - API Documentation: http://localhost:8000/docs

5. Register a new account and start uploading CSV files

### Local Development Setup

#### Backend

1. Install Python dependencies:
   ```
   cd backend
   pip install -r requirements.txt
   ```

2. Set environment variables:
   ```
   export DATABASE_URL=postgresql://user:password@localhost/data_ingestion
   export AWS_ENDPOINT_URL=http://localhost:4566
   export S3_BUCKET=data-ingestion
   export SQS_QUEUE_NAME=applications
   export JWT_SECRET=your-secret-key
   ```

3. Run database migrations:
   ```
   python -m alembic upgrade head
   ```

4. Start the API server:
   ```
   uvicorn main:app --reload
   ```

5. In another terminal, start the worker:
   ```
   python worker.py
   ```

#### Frontend

1. Install Node dependencies:
   ```
   cd frontend
   npm install
   ```

2. Start development server:
   ```
   npm run dev
   ```

3. Open http://localhost:5173

## API Endpoints

### Authentication
- POST /auth/register - Create new user account
- POST /auth/login - Login and receive JWT token

### Applications
- POST /applications - Upload a CSV file
- GET /applications - List all applications for current user
- GET /applications/{id} - Get details of specific application
- POST /applications/{id}/issues/{issue_id}/resolve - Resolve a detected conflict
- POST /applications/{id}/finalize - Mark application as complete

All endpoints except register and login require authentication with JWT token.

## Data Validation Rules

The system validates CSV data with the following rules:

Auto-Rejected (no user review):
- Missing email address
- Invalid email format
- Malformed CSV rows
- Missing required columns

Requires User Review:
- Duplicate email addresses with conflicting identity information

See VALIDATION_RULES.md for complete validation documentation.

## Project Structure

```
backend/
  main.py - FastAPI application and endpoints
  models.py - SQLAlchemy ORM models
  schemas.py - Pydantic request/response schemas
  auth.py - Authentication and JWT logic
  config.py - Configuration from environment variables
  constants.py - Enums and constant values
  database.py - Database connection setup
  worker.py - Background worker for processing
  services/
    storage.py - S3 file operations
    queue.py - SQS queue operations
  requirements.txt - Python dependencies
  Dockerfile - Docker image for backend

frontend/
  src/
    main.tsx - Application entry point
    App.tsx - Root component with routing
    api/
      client.ts - API client wrapper
    pages/
      Login.tsx - Login and registration page
      Uploads.tsx - Applications dashboard
      UploadDetail.tsx - Application details and issue resolution
    utils/
      errorHandler.ts - Error message handling
  package.json - Node dependencies
  tsconfig.json - TypeScript configuration
  vite.config.ts - Vite build configuration
  Dockerfile - Docker image for frontend

docker-compose.yml - Service orchestration
init-aws.sh - LocalStack initialization script
```

## Workflow Example

1. User registers and logs in
2. User selects a CSV file to upload
3. Frontend validates file and uploads to backend
4. Backend stores file in S3 and queues for processing
5. User sees application with PENDING status
6. Background worker processes CSV:
   - Parses all rows
   - Validates each row
   - Detects duplicate emails
   - Creates Issue records for conflicts
   - Updates application status to NEEDS_REVIEW
7. User receives notification and navigates to application detail
8. User reviews each issue:
   - Sees all rows with same email
   - Selects which row is correct
   - Chooses action (keep, merge, discard)
9. All issues are resolved
10. User clicks Finalize
11. System generates final deduplicated contact list
12. Application status changes to COMPLETED
13. User can download or export results

## Error Handling

The system handles various error scenarios:

- Invalid CSV format - Application marked FAILED with error message
- Empty files - Rejected with validation error
- Missing required columns - Rejected with specific column name
- Network errors - Worker retries processing
- Database errors - Detailed logging for debugging

## Performance Considerations

- CSV processing happens asynchronously, not blocking the API
- File uploads limited to 5MB
- Background worker processes one application at a time
- Database queries optimized with appropriate indexes
- Frontend polls API every 3 seconds for status updates

## Security

- Passwords hashed with bcrypt
- JWT tokens for stateless authentication
- Token expiration set to 24 hours
- CORS enabled only for frontend domain
- Database transactions for data consistency
- Input validation on all API endpoints

## Troubleshooting

### Database Connection Error
- Ensure PostgreSQL is running
- Check DATABASE_URL environment variable
- Verify database exists and is accessible

### S3/SQS Connection Error
- Ensure LocalStack is running (or AWS credentials if using real AWS)
- Check AWS_ENDPOINT_URL points to correct address
- Verify bucket and queue names exist

### Worker Not Processing Files
- Check worker process is running
- Check SQS queue has messages
- Check worker logs for errors
- Verify S3 bucket exists and is readable

### Upload Fails
- Check file is valid CSV
- Verify file size under 5MB
- Check backend has write permissions to upload directory
- Verify S3 connection is working

## Documentation

- Info.md - Detailed documentation of each file in the project
- ARCHITECTURE_DIAGRAMS.md - Visual system architecture and design decisions
- VALIDATION_RULES.md - Complete validation rules documentation
- VIDEO_PRESENTATION_GUIDE.md - 5-part presentation script for demonstrating the project

## License

This project is submitted as an assignment for Complaion Full-Stack Developer position.

## Author

Erkam - January 2026

## Support

For questions or issues, please refer to the documentation files listed above or examine the code comments for implementation details.
