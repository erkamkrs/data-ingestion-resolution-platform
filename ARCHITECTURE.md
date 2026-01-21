# Architecture Diagrams & AWS Mapping

This document provides detailed visual representations of the system
architecture, comparing local development setup with production AWS
deployment.

## Table of Contents

1.  [Project Structure](#project-structure)
2.  [Architecture Overview](#architecture-overview)
3.  [High-Level System Flow](#high-level-system-flow)
4.  [Local Development Architecture](#local-development-architecture)
5.  [Production AWS Architecture](#production-aws-architecture)
6.  [Component Mapping: Local vs AWS](#component-mapping-local-vs-aws)
7.  [Data Flow Diagrams](#data-flow-diagrams)
8.  [Deployment Patterns](#deployment-patterns)

## Project Structure

### Complete Directory Layout

    data-ingestion-tool/
    │
    ├──  docker-compose.yml          # Orchestrates all containers
    ├──  init-aws.sh                 # LocalStack initialization script
    ├──  test-jobs.csv               # Sample test data
    │
    ├──  backend/                    # Python FastAPI Application
    │   ├──  main.py                 # API endpoints (upload, list, resolve, finalize)
    │   ├──  worker.py               # Background worker (CSV processing)
    │   ├──  models.py               # SQLAlchemy ORM models
    │   ├──  schemas.py              # Pydantic request/response schemas
    │   ├──  auth.py                 # JWT authentication logic
    │   ├──  config.py               # Configuration and settings
    │   ├──  constants.py            # Enum values (JobStatus, IssueType, etc)
    │   ├──  database.py             # Database connection and session
    │   ├──  requirements.txt         # Python dependencies
    │   ├──  Dockerfile              # Backend container image
    │   │
    │   └──  services/               # Reusable service modules
    │       ├──  storage.py          # S3 upload/download operations (boto3)
    │       └──  queue.py            # SQS publish/consume operations (boto3)
    │
    ├──  frontend/                   # React TypeScript Application
    │   ├──  package.json            # Node.js dependencies and scripts
    │   ├──  tsconfig.json           # TypeScript configuration
    │   ├──  vite.config.ts          # Vite build tool configuration
    │   ├──  Dockerfile              # Frontend container image
    │   ├──  index.html              # HTML entry point
    │   │
    │   └──  src/                    # TypeScript/React source code
    │       ├──  main.tsx            # React DOM render entry point
    │       ├──  App.tsx             # Root component with routing
    │       ├──  vite-env.d.ts       # Vite environment types
    │       │
    │       ├──  api/                # API client code
    │       │   └──  client.ts       # HTTP wrapper (axios) with interceptors
    │       │
    │       └──  pages/              # Page components
    │           ├──  Login.tsx       # Authentication UI (register/login)
    │           ├──  Uploads.tsx        #  list page
    │           ├──  UploadDetails.tsx   # Job detail with issue resolution UI
    │           └── (Routing handled in App.tsx)
    │
    ├──  docs/                       # Documentation
    │   ├──  README.md               # Project overview and setup
    │   ├──  ARCHITECTURE_DIAGRAMS.md # This file
    │   ├──  PRESENTATION_1_INTRO.md
    │   ├──  PRESENTATION_2_BACKEND.md
    │   ├──  PRESENTATION_3_FRONTEND.md
    │   ├──  PRESENTATION_4_CLOSING.md
    │   └──  CHANGELOG.md            # Development history
    │
    └──  .git/                       # Git version control

### Directory Purpose Overview

  ------------------------------------------------------------------------
  Directory                 Purpose              Key Files
  ------------------------- -------------------- -------------------------
  **backend/**              FastAPI REST API +   main.py, worker.py,
                            Worker               models.py

  **backend/services/**     AWS service          storage.py (S3), queue.py
                            integrations         (SQS)

  **frontend/src/**         React UI application App.tsx, pages/\*.tsx

  **frontend/src/api/**     HTTP client wrapper  client.ts with
                                                 interceptors

  **frontend/src/pages/**   Page components      Login, Jobs list, Job
                                                 detail

  **Root**                  Docker orchestration docker-compose.yml
  ------------------------------------------------------------------------

## Architecture Overview

### System Architecture at a Glance

                              FRONTEND (React + TypeScript)
                              ┌──────────────────────────┐
                              │                          │
                              │  - Pages: Login, Upload, │
                              │    Jobs, JobDetail       │
                              │                          │
                              │  - API Client:           │
                              │    Axios + JWT auth      │
                              │                          │
                              │  - Polling:              │
                              │    Status every 3 sec    │
                              │                          │
                              └────────────┬─────────────┘
                                           │
                              HTTP/REST    │
                                           │
                              ┌────────────▼─────────────┐
                              │   BACKEND (FastAPI)      │
                              │                          │
                              │  - Upload endpoint       │
                              │  - Job list/detail       │
                              │  - Issue resolution      │
                              │  - User authentication   │
                              │                          │
                              └────────────┬─────────────┘
                                           │
              ┌────────────────────────────┼────────────────────────────┐
              │                            │                            │
              ▼                            ▼                            ▼
        ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
        │  PostgreSQL  │          │      S3      │          │     SQS      │
        │  Database    │          │   Storage    │          │    Queue     │
        │              │          │              │          │              │
        │ - Jobs       │          │ - Raw CSVs   │          │ - Messages   │
        │ - RawRows    │          │ - Uploaded   │          │ - Job IDs    │
        │ - Issues     │          │   files      │          │              │
        │ - Contacts   │          │              │          │              │
        └──────────────┘          └──────────────┘          └──────┬───────┘
                                                                    │
                                                                    │
                                                       ┌────────────▼────────────┐
                                                       │  WORKER (Python)        │
                                                       │                         │
                                                       │  - Polls SQS queue      │
                                                       │  - Downloads CSV from S3│
                                                       │  - Parses & validates   │
                                                       │  - Detects duplicates   │
                                                       │  - Creates issues       │
                                                       │  - Updates DB status    │
                                                       │                         │
                                                       └─────────────────────────┘

    KEY PATTERN: Event-Driven & Asynchronous
      Upload (sync) → Returns Immediately
      Processing (async) → Worker picks up from queue
      Status (polling) → Frontend checks every 3 seconds

### Technology Stack

    ┌─────────────────────────────────────────────────────────────────────┐
    │                     PRESENTATION LAYER                              │
    │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
    │  │     React 18     │  │   TypeScript     │  │   Vite (Build)   │ │
    │  │                  │  │                  │  │                  │ │
    │  │ - Components     │  │ - Type safety    │  │ - Fast HMR       │ │
    │  │ - State (hooks)  │  │ - IDE support    │  │ - ES modules     │ │
    │  │ - Routing        │  │ - Compile-time   │  │ - Optimized build│ │
    │  │                  │  │   checks         │  │                  │ │
    │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
    └─────────────────────────────────────────────────────────────────────┘
                                   │
                             HTTP (RESTful API)
                                   │
    ┌─────────────────────────────────────────────────────────────────────┐
    │                     APPLICATION LAYER                               │
    │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐ │
    │  │    FastAPI       │  │   Pydantic       │  │  SQLAlchemy ORM  │ │
    │  │                  │  │                  │  │                  │ │
    │  │ - Async/await    │  │ - Validation     │  │ - ORM mapping    │ │
    │  │ - Auto OpenAPI   │  │ - Serialization  │  │ - Query builder  │ │
    │  │ - Type hints     │  │ - Type-safe      │  │ - Transactions   │ │
    │  │ - JWT auth       │  │                  │  │                  │ │
    │  └──────────────────┘  └──────────────────┘  └──────────────────┘ │
    │  ┌──────────────────────────────────────────────────────────────┐ │
    │  │           Background Worker (Python)                        │ │
    │  │                                                              │ │
    │  │  - Async task processing                                    │ │
    │  │  - CSV parsing (csv module)                                 │ │
    │  │  - Email validation & normalization                         │ │
    │  │                                                              │ │
    │  └──────────────────────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────────────────────────┘
                                   │
                  ┌────────────────┼────────────────┐
                  │                │                │
                  ▼                ▼                ▼
    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
    │   PostgreSQL     │  │   boto3 (AWS)    │  │   boto3 (AWS)    │
    │                  │  │                  │  │                  │
    │ - Database       │  │ - S3 operations  │  │ - SQS operations │
    │ - ACID           │  │ - Upload/Download│  │ - Publish/Consume│
    │ - Transactions   │  │ - Object storage │  │ - Message queue  │
    │ - Constraints    │  │                  │  │                  │
    │                  │  │                  │  │                  │
    └──────────────────┘  └──────────────────┘  └──────────────────┘

## High-Level System Flow

### User Journey Flow

    ┌─────────────┐
    │   User      │
    │  (Browser)  │
    └──────┬──────┘
           │
           │ 1. Upload CSV
           ▼
    ┌─────────────────────┐
    │   React Frontend    │
    │   (localhost:5173)  │
    └──────┬──────────────┘
           │
           │ 2. POST /jobs (with file)
           ▼
    ┌─────────────────────┐
    │   FastAPI Backend   │
    │  (localhost:8000)   │
    └──────┬──────────────┘
           │
           ├─── 3. Store in Database ──────┐
           │                                ▼
           │                         ┌──────────────┐
           │                         │  PostgreSQL  │
           │                         │  (port 5432) │
           │                         └──────────────┘
           │
           ├─── 4. Upload to S3 ───────────┐
           │                                ▼
           │                         ┌──────────────┐
           │                         │ S3 (Storage) │
           │                         │  LocalStack  │
           │                         └──────────────┘
           │
           └─── 5. Publish to Queue ───────┐
                                            ▼
                                     ┌──────────────┐
                                     │ SQS (Queue)  │
                                     │  LocalStack  │
                                     └──────┬───────┘
                                            │
                                            │ 6. Poll for messages
                                            ▼
                                     ┌──────────────┐
                                     │    Worker    │
                                     │   Process    │
                                     └──────┬───────┘
                                            │
             ┌──────────────────────────────┼──────────────────────────┐
             │                              │                          │
             │ 7. Download CSV from S3      │ 8. Parse & Validate     │ 9. Create Issues
             ▼                              ▼                          ▼
      ┌──────────────┐              ┌──────────────┐          ┌──────────────┐
      │      S3      │              │  PostgreSQL  │          │  PostgreSQL  │
      │   (Storage)  │              │   (RawRows)  │          │   (Issues)   │
      └──────────────┘              └──────────────┘          └──────────────┘
                                            │
                                            │ 10. Update job status
                                            ▼
                                     ┌──────────────┐
                                     │  PostgreSQL  │
                                     │   (Job =     │
                                     │ NEEDS_REVIEW)│
                                     └──────────────┘

## Issue Resolution Flow (Edit / Choose / Skip)

```mermaid
flowchart TD
    A[User opens Upload Detail] --> B{Issue Type}
    B -->|Duplicate Email| C[Choose one of candidate rows]
    B -->|Missing Email| D[Enter valid email address]
    B -->|Invalid Email Format| D
    B -->|Missing First/Last/Company| E[Type missing field]
    C --> F[POST /issues/{id}/resolve {action:"choose", chosen_row_id}]
    D --> D1{Valid format?}
    D1 -- Yes --> G[POST /issues/{id}/resolve {action:"edit", updated_data:{email}}]
    D1 -- No --> H[Show validation error]
    E --> I[POST /issues/{id}/resolve {action:"edit", updated_data:{field}}]
    J[Skip] --> K[POST /issues/{id}/resolve {action:"skip"}]
    F --> L[Issue marked RESOLVED]
    G --> L
    I --> L
    K --> L
    L --> M[Recalculate status]
    M -->|All resolved| N[Finalize: POST /applications/{id}/finalize]
    M -->|Open issues| A
```

Notes:
- Frontend enforces email format on Missing/Invalid email issues before sending the resolution.
- Backend stores an `IssueResolution` record for full audit and updates `Issue` status on success.

## Local vs AWS Architecture Comparison

### Side-by-Side Visual Comparison

    ╔════════════════════════════════════════════════════════════════════════════╗
    ║                         LOCAL DEVELOPMENT                                  ║
    ╚════════════════════════════════════════════════════════════════════════════╝

                  ┌─────────────────────────────────────────────────┐
                  │         Your Laptop / Development Machine       │
                  │                                                 │
                  │  Docker Desktop / Docker Engine                 │
                  │                                                 │
                  │  ┌───────────────────────────────────────────┐ │
                  │  │        Docker Network (bridge)            │ │
                  │  │                                           │ │
                  │  │  ┌──────────┐  ┌──────────┐  ┌─────────┐ │ │
                  │  │  │ Frontend │  │  Backend │  │ Worker  │ │ │
                  │  │  │          │  │          │  │         │ │ │
                  │  │  │  React   │  │ FastAPI  │  │ Python  │ │ │
                  │  │  │  :5173   │  │ :8000    │  │ process │ │ │
                  │  │  └──────────┘  └──────────┘  └─────────┘ │ │
                  │  │       │              │           │         │ │
                  │  │       └──────────────┼───────────┘         │ │
                  │  │                      │                     │ │
                  │  │                      ▼                     │ │
                  │  │  ┌──────────────────────────────────────┐ │ │
                  │  │  │    PostgreSQL Container              │ │ │
                  │  │  │    Port: 5432                        │ │ │
                  │  │  │    Volume: local disk                │ │ │
                  │  │  └──────────────────────────────────────┘ │ │
                  │  │                  ▲                         │ │
                  │  │                  │                         │ │
                  │  │  ┌───────────────┴─────────────────────┐ │ │
                  │  │  │                                     │ │ │
                  │  │  ▼                                     ▼ │ │
                  │  │  ┌──────────────┐          ┌──────────────┐ │
                  │  │  │  LocalStack  │          │  LocalStack  │ │
                  │  │  │  (S3 sim)    │          │  (SQS sim)   │ │
                  │  │  │ :4566        │          │  :4566       │ │
                  │  │  │              │          │              │ │
                  │  │  │ Bucket:      │          │ Queue:       │ │
                  │  │  │ data-ing...  │          │ data-ing...  │ │
                  │  │  │              │          │              │ │
                  │  │  └──────────────┘          └──────────────┘ │
                  │  └───────────────────────────────────────────┘ │
                  │                                                 │
                  │  Browser: http://localhost:5173                │
                  └─────────────────────────────────────────────────┘

    Key Characteristics:
    ✓ All services in single machine
    ✓ No network latency
    ✓ LocalStack simulates AWS
    ✓ Free (only electricity cost)
    ✓ Fast iteration (restart in seconds)
    ✓ No AWS account needed


    ╔════════════════════════════════════════════════════════════════════════════╗
    ║                         PRODUCTION AWS                                     ║
    ╚════════════════════════════════════════════════════════════════════════════╝

            ┌──────────────────────────────────────────────────────────┐
            │                    AWS Cloud Account                      │
            │                   (us-east-1 region)                      │
            │                                                            │
            │  ┌────────────────────────────────────────────────────┐  │
            │  │  AWS VPC (Virtual Private Cloud)                   │  │
            │  │  ┌────────────────────────────────────────────┐   │  │
            │  │  │  Public Subnet (Frontend / ALB)             │   │  │
            │  │  │                                             │   │  │
            │  │  │  ┌──────────────┐   ┌──────────────────┐   │   │  │
            │  │  │  │  CloudFront  │   │   ALB            │   │   │  │
            │  │  │  │  CDN         │   │   (Load          │   │   │  │
            │  │  │  │              │   │   Balancer)      │   │   │  │
            │  │  │  └──────────────┘   └────────┬─────────┘   │   │  │
            │  │  │                               │             │   │  │
            │  │  └───────────────────────────────┼─────────────┘   │  │
            │  │                                  │                 │  │
            │  │  ┌────────────────────────────────▼──────────────┐ │  │
            │  │  │  Private Subnet (Backend / Worker)            │ │  │
            │  │  │                                               │ │  │
            │  │  │  ┌──────────────┐  ┌──────────────────────┐  │ │  │
            │  │  │  │  ECS/Fargate │  │  ECS/Fargate        │  │ │  │
            │  │  │  │  (API Tasks) │  │  (Worker Tasks)     │  │ │  │
            │  │  │  │              │  │                      │  │ │  │
            │  │  │  │ - 2-10 tasks │  │ - 1-5 tasks         │  │ │  │
            │  │  │  │ - Auto-scale │  │ - Auto-scale queue  │  │ │  │
            │  │  │  │              │  │                      │  │ │  │
            │  │  │  └──────────────┘  └──────────────────────┘  │ │  │
            │  │  │         │                      │              │ │  │
            │  │  │         └──────────┬───────────┘              │ │  │
            │  │  │                    │                          │ │  │
            │  │  │                    ▼                          │ │  │
            │  │  │  ┌──────────────────────────────────────┐   │ │  │
            │  │  │  │    Amazon RDS PostgreSQL             │   │ │  │
            │  │  │  │    - Primary + Read Replicas         │   │ │  │
            │  │  │  │    - Multi-AZ failover               │   │ │  │
            │  │  │  │    - Automated backups               │   │ │  │
            │  │  │  │    - Encryption at rest              │   │ │  │
            │  │  │  └──────────────────────────────────────┘   │ │  │
            │  │  └───────────────────────────────────────────────┘ │  │
            │  │                                                    │  │
            │  │  ┌────────────────────────────────────────────┐   │  │
            │  │  │  Public Subnet (Storage & Queue)          │   │  │
            │  │  │                                             │   │  │
            │  │  │  ┌──────────────┐   ┌──────────────────┐   │   │  │
            │  │  │  │  S3 Bucket   │   │  SQS Queue       │   │   │  │
            │  │  │  │              │   │                  │   │   │  │
            │  │  │  │ - Versioning │   │ - Visibility: 5min   │   │  │
            │  │  │  │ - Encryption │   │ - Retention: 14 day  │   │  │
            │  │  │  │ - Lifecycle  │   │ - DLQ attached   │   │   │  │
            │  │  │  │ - Redundancy │   │                  │   │   │  │
            │  │  │  └──────────────┘   └──────────────────┘   │   │  │
            │  │  └────────────────────────────────────────────┘   │  │
            │  │                                                    │  │
            │  │  ┌────────────────────────────────────────────┐   │  │
            │  │  │  Monitoring & Security                     │   │  │
            │  │  │                                             │   │  │
            │  │  │ - CloudWatch Logs (all services)           │   │  │
            │  │  │ - CloudWatch Metrics (CPU, Memory, etc)    │   │  │
            │  │  │ - CloudWatch Alarms (notify on errors)     │   │  │
            │  │  │ - X-Ray (distributed tracing)              │   │  │
            │  │  │ - VPC Flow Logs (network traffic)          │   │  │
            │  │  │ - IAM Roles (least privilege access)       │   │  │
            │  │  │ - Secrets Manager (credentials)            │   │  │
            │  │  └────────────────────────────────────────────┘   │  │
            │  └────────────────────────────────────────────────────┘  │
            │                                                            │
            │  Browser: https://yourdomain.com                          │
            └──────────────────────────────────────────────────────────┘

    Key Characteristics:
    ✓ Distributed across availability zones (high availability)
    ✓ Managed services (no server management)
    ✓ Auto-scaling based on load
    ✓ Encryption and security built-in
    ✓ Monitoring and alerting
    ✓ Expensive (pay for what you use)
    ✗ Network latency (but negligible for this use case)
    ✗ AWS account required


    ╔════════════════════════════════════════════════════════════════════════════╗
    ║                    QUICK MAPPING TABLE                                     ║
    ╚════════════════════════════════════════════════════════════════════════════╝

    Component          │  Local Dev               │  Production AWS
    ───────────────────┼──────────────────────────┼────────────────────────────
    Frontend           │  Docker container        │  S3 + CloudFront (CDN)
                       │  Vite dev server         │  Static files
                       │  :5173                   │  
    ───────────────────┼──────────────────────────┼────────────────────────────
    API                │  Docker container        │  ECS/Fargate tasks
                       │  Uvicorn                 │  Behind ALB
                       │  :8000                   │  Auto-scaled 2-10
    ───────────────────┼──────────────────────────┼────────────────────────────
    Worker             │  Docker container        │  ECS/Fargate tasks
                       │  Python process          │  OR AWS Lambda
                       │  Single instance         │  Auto-scaled 1-5
    ───────────────────┼──────────────────────────┼────────────────────────────
    Database           │  PostgreSQL container    │  Amazon RDS
                       │  localhost:5432          │  Multi-AZ
                       │  Local volume            │  Automated backups
    ───────────────────┼──────────────────────────┼────────────────────────────
    File Storage (S3)  │  LocalStack               │  Amazon S3
                       │  localhost:4566          │  Versioned, encrypted
                       │  In-memory               │  Lifecycle policies
    ───────────────────┼──────────────────────────┼────────────────────────────
    Queue (SQS)        │  LocalStack              │  Amazon SQS
                       │  localhost:4566          │  Dead Letter Queue
                       │  In-memory               │  14-day retention
    ───────────────────┼──────────────────────────┼────────────────────────────
    Logging            │  Docker logs             │  CloudWatch Logs
                       │  stdout/stderr           │  Searchable, archived
    ───────────────────┼──────────────────────────┼────────────────────────────
    Monitoring         │  Manual (docker stats)   │  CloudWatch Metrics
                       │  No alerting             │  Custom dashboards, alarms
    ───────────────────┼──────────────────────────┼────────────────────────────
    Secrets/Config     │  .env file               │  Secrets Manager
                       │  (dev only, not versioned) │  (encrypted, audited)
    ───────────────────┼──────────────────────────┼────────────────────────────
    Cost               │  $0 (electricity)        │  $100-500/month typical
    ───────────────────┼──────────────────────────┼────────────────────────────
    Setup Time         │  5 minutes               │  2-4 hours (terraform)
    ───────────────────┼──────────────────────────┼────────────────────────────
    Code Changes       │  None (same as prod)     │  None (same as dev)
                       │  Only config changes     │  Only config changes

### Why This Matters

The key insight: **Same code, different infrastructure**

    # backend/config.py - Works for BOTH local and AWS!

    import boto3
    from sqlalchemy import create_engine

    class Settings:
        # These change per environment
        database_url = os.getenv("DATABASE_URL")
        aws_endpoint_url = os.getenv("AWS_ENDPOINT_URL", None)
        s3_bucket = os.getenv("S3_BUCKET", "data-ingestion-bucket")
        
        def get_s3_client(self):
            # If endpoint_url is None, uses real AWS
            # If endpoint_url is localhost:4566, uses LocalStack
            return boto3.client('s3', endpoint_url=self.aws_endpoint_url)
        
        def get_sqs_client(self):
            # Same logic - works for both!
            return boto3.client('sqs', endpoint_url=self.aws_endpoint_url)
        
        def get_db(self):
            # SQLAlchemy connection string works for both local and RDS
            return create_engine(self.database_url)

**Benefits:** - Develop locally without AWS costs - Confidence code will
work in production - Easy to test AWS behavior locally - No "works on my
machine" surprises - Faster debugging and iteration

## Local Development Architecture

### Docker Compose Setup (What You Run Locally)

    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                        Docker Compose Environment                            │
    │                      (Started with: docker compose up)                       │
    ├─────────────────────────────────────────────────────────────────────────────┤
    │                                                                               │
    │  ┌─────────────────┐         ┌─────────────────┐       ┌─────────────────┐ │
    │  │   Frontend      │         │    Backend      │       │     Worker      │ │
    │  │   Container     │         │   Container     │       │   Container     │ │
    │  │                 │         │                 │       │                 │ │
    │  │  React + Vite   │◄────────┤   FastAPI      │       │  Python Process │ │
    │  │  TypeScript     │  HTTP   │   Uvicorn      │       │  Polls SQS      │ │
    │  │                 │         │                 │       │                 │ │
    │  │  Port: 5173     │         │  Port: 8000     │       │  No exposed port│ │
    │  └────────┬────────┘         └────────┬────────┘       └────────┬────────┘ │
    │           │                           │                          │          │
    │           │                           │                          │          │
    │           └───────────────────────────┼──────────────────────────┘          │
    │                                       │                                      │
    │                                       ▼                                      │
    │  ┌─────────────────────────────────────────────────────────────────────┐   │
    │  │                       PostgreSQL Container                          │   │
    │  │                                                                     │   │
    │  │  Database: ingestion_db                                            │   │
    │  │  Port: 5432                                                         │   │
    │  │  Tables: users, jobs, raw_rows, issues, issue_resolutions,         │   │
    │  │          final_contacts                                             │   │
    │  │                                                                     │   │
    │  └─────────────────────────────────────────────────────────────────────┘   │
    │                                                                               │
    │                                       ▲                                      │
    │                                       │                                      │
    │                    ┌──────────────────┴──────────────────┐                  │
    │                    │                                      │                  │
    │  ┌─────────────────┴────────────┐     ┌──────────────────┴───────────────┐ │
    │  │    LocalStack Container       │     │     LocalStack Container         │ │
    │  │    (AWS S3 Simulator)         │     │     (AWS SQS Simulator)          │ │
    │  │                               │     │                                  │ │
    │  │  Bucket: data-ingestion-      │     │  Queue: data-ingestion-queue    │ │
    │  │          bucket               │     │                                  │ │
    │  │  Endpoint: localhost:4566     │     │  Endpoint: localhost:4566       │ │
    │  │                               │     │                                  │ │
    │  │  Stores CSV files             │     │  Messages: {"job_id": X,        │ │
    │  │  Path: uploads/uX/job-Y.csv   │     │             "file_key": "..."}  │ │
    │  │                               │     │                                  │ │
    │  └───────────────────────────────┘     └──────────────────────────────────┘ │
    │                                                                               │
    └─────────────────────────────────────────────────────────────────────────────┘

    External Access:
    ┌──────────────────┐
    │   Your Browser   │  ──────►  http://localhost:5173  (Frontend)
    └──────────────────┘           http://localhost:8000  (API)

### Key Points - Local Development:

-   **Everything runs in Docker containers** - Consistent environment
-   **LocalStack** simulates AWS services (S3 + SQS) at localhost:4566
-   **No AWS account needed** - Complete development environment offline
-   **Same code as production** - Only configuration changes (endpoint
    URLs)
-   **Fast iteration** - No network latency, no AWS costs

## Production AWS Architecture

### Cloud Deployment (What Runs in Production)

                                        Internet
                                           │
                                           │  HTTPS
                                           ▼
    ┌────────────────────────────────────────────────────────────────────────────┐
    │                              AWS Cloud                                      │
    ├────────────────────────────────────────────────────────────────────────────┤
    │                                                                              │
    │  ┌──────────────────┐         ┌───────────────────────────────────────┐   │
    │  │  CloudFront CDN  │         │  Application Load Balancer (ALB)      │   │
    │  │  (Static Assets) │         │  - SSL/TLS Termination                │   │
    │  │                  │         │  - Health checks                       │   │
    │  │  Frontend SPA    │         │  - Auto-scaling trigger                │   │
    │  │  (React build)   │         └───────────────┬───────────────────────┘   │
    │  └──────────────────┘                         │                            │
    │                                                ▼                            │
    │  ┌─────────────────────────────────────────────────────────────────────┐  │
    │  │               ECS/Fargate Cluster (API Service)                      │  │
    │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │  │
    │  │  │   API Task   │  │   API Task   │  │   API Task   │              │  │
    │  │  │              │  │              │  │              │  (Auto-scaled)│  │
    │  │  │   FastAPI    │  │   FastAPI    │  │   FastAPI    │              │  │
    │  │  │   Container  │  │   Container  │  │   Container  │              │  │
    │  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │  │
    │  └─────────┼──────────────────┼──────────────────┼─────────────────────┘  │
    │            │                  │                  │                         │
    │            └──────────────────┼──────────────────┘                         │
    │                               │                                             │
    │                               ▼                                             │
    │  ┌─────────────────────────────────────────────────────────────────────┐  │
    │  │                     Amazon RDS (PostgreSQL)                          │  │
    │  │                                                                      │  │
    │  │  Primary Instance:  db-1.region.rds.amazonaws.com                  │  │
    │  │  Read Replica:      db-1-read.region.rds.amazonaws.com             │  │
    │  │  Multi-AZ:          Automatic failover                              │  │
    │  │  Backup:            Automated daily snapshots                       │  │
    │  │                                                                      │  │
    │  └──────────────────────────────────────────────────────────────────────┘  │
    │                                                                              │
    │            ┌─────────────────────────────────────────────┐                 │
    │            │                                             │                 │
    │            ▼                                             ▼                 │
    │  ┌──────────────────────┐                    ┌──────────────────────────┐ │
    │  │     Amazon S3        │                    │      Amazon SQS          │ │
    │  │                      │                    │                          │ │
    │  │  Bucket: prod-data-  │                    │  Queue: prod-ingestion-  │ │
    │  │         ingestion    │                    │         queue            │ │
    │  │                      │                    │                          │ │
    │  │  Storage Class:      │                    │  Settings:               │ │
    │  │  - Standard (recent) │                    │  - Visibility: 300s      │ │
    │  │  - IA (30+ days)     │                    │  - Retention: 14 days    │ │
    │  │  - Glacier (90+ days)│                    │  - DLQ: prod-ingestion-  │ │
    │  │                      │                    │         dlq              │ │
    │  │  Versioning: Enabled │                    │  - Max Receives: 3       │ │
    │  │  Encryption: AES-256 │                    │                          │ │
    │  │                      │                    │                          │ │
    │  └──────────────────────┘                    └────────────┬─────────────┘ │
    │                                                            │               │
    │                                                            │ Trigger       │
    │                                                            ▼               │
    │  ┌─────────────────────────────────────────────────────────────────────┐  │
    │  │               ECS/Fargate Cluster (Worker Service)                   │  │
    │  │                                                                      │  │
    │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
    │  │  │ Worker Task  │  │ Worker Task  │  │ Worker Task  │             │  │
    │  │  │              │  │              │  │              │ (Auto-scaled)│  │
    │  │  │   Python     │  │   Python     │  │   Python     │             │  │
    │  │  │   Worker     │  │   Worker     │  │   Worker     │             │  │
    │  │  │   Container  │  │   Container  │  │   Container  │             │  │
    │  │  │              │  │              │  │              │             │  │
    │  │  │ Polls SQS    │  │ Polls SQS    │  │ Polls SQS    │             │  │
    │  │  │ Processes    │  │ Processes    │  │ Processes    │             │  │
    │  │  │ Downloads S3 │  │ Downloads S3 │  │ Downloads S3 │             │  │
    │  │  │              │  │              │  │              │             │  │
    │  │  └──────────────┘  └──────────────┘  └──────────────┘             │  │
    │  │                                                                      │  │
    │  └──────────────────────────────────────────────────────────────────────┘  │
    │                                                                              │
    │  ┌──────────────────────────────────────────────────────────────────────┐  │
    │  │                    Monitoring & Logging                               │  │
    │  │                                                                       │  │
    │  │  CloudWatch:  - Logs (API, Worker)                                  │  │
    │  │               - Metrics (CPU, Memory, Queue Depth)                   │  │
    │  │               - Alarms (Queue > 100, Worker errors)                  │  │
    │  │                                                                       │  │
    │  │  X-Ray:       - Distributed tracing                                  │  │
    │  │               - Request flow visualization                            │  │
    │  │                                                                       │  │
    │  └───────────────────────────────────────────────────────────────────────┘  │
    │                                                                              │
    └──────────────────────────────────────────────────────────────────────────────┘

### Alternative: Lambda-based Worker (Serverless Option)

                         ┌──────────────────────┐
                         │    Amazon SQS        │
                         │                      │
                         │  Queue: prod-        │
                         │  ingestion-queue     │
                         └──────────┬───────────┘
                                    │
                                    │ Event Source Mapping
                                    │ (1-10 messages per invocation)
                                    ▼
                         ┌──────────────────────┐
                         │   AWS Lambda         │
                         │                      │
                         │  Function: process-  │
                         │  csv-worker          │
                         │                      │
                         │  Runtime: Python 3.11│
                         │  Memory: 1024 MB     │
                         │  Timeout: 5 minutes  │
                         │                      │
                         │  Concurrency: 10     │
                         │  (processes 10 jobs  │
                         │   in parallel)       │
                         │                      │
                         └──────────┬───────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │                             │
                     ▼                             ▼
          ┌──────────────────┐         ┌──────────────────┐
          │   Amazon S3      │         │   Amazon RDS     │
          │   (CSV files)    │         │   (PostgreSQL)   │
          └──────────────────┘         └──────────────────┘

    Benefits:
    - No server management
    - Pay per execution (not idle time)
    - Automatic scaling (0 to 1000s)
    - Built-in retry and DLQ

    Trade-offs:
    - 15-minute max execution time
    - Cold start latency (~500ms)
    - Limited to 10GB memory
    - More complex debugging

## Component Mapping: Local vs AWS

### Side-by-Side Comparison

  ----------------------------------------------------------------------------------------------------
  Component          Local Development                   Production AWS               Notes
  ------------------ ----------------------------------- ---------------------------- ----------------
  **Frontend**       Docker container (Vite dev          CloudFront + S3Static files  Local:
                     server)Port: 5173Hot reload enabled (build output)CDN            Development
                                                         distribution                 modeProd:
                                                                                      Optimized build

  **Backend API**    Docker container (Uvicorn)Port:     ECS/Fargate TasksBehind      Same FastAPI
                     8000Auto-reload on changes          ALBAuto-scaling (2-10 tasks) codeDifferent
                                                                                      config

  **Worker**         Docker containerSingle processLogs  ECS/Fargate Tasks ORAWS      Same processing
                     to stdout                           LambdaAuto-scaling based on  logicLambda
                                                         queue                        requires adapter

  **File Storage**   LocalStack (S3                      Amazon S3Durable,            boto3 client
                     simulator)localhost:4566Files in    versionedLifecycle policies  works for
                     container volume                                                 bothOnly
                                                                                      endpoint URL
                                                                                      changes

  **Message Queue**  LocalStack (SQS                     Amazon SQSManaged            boto3 client
                     simulator)localhost:4566In-memory   serviceDead Letter Queue     works for
                     queue                                                            bothOnly
                                                                                      endpoint URL
                                                                                      changes

  **Database**       PostgreSQL containerPort: 5432Data  Amazon RDS                   SQLAlchemy ORM
                     in Docker volume                    PostgreSQLMulti-AZ           works for
                                                         deploymentAutomated backups  bothConnection
                                                                                      string changes

  **Secrets**        .env filePlain text (dev only!)     AWS Secrets Manager          Never commit
                                                         ORParameter StoreEncrypted   .env to git!

  **Logging**        stdout/stderrView with              CloudWatch LogsStructured    Should use same
                     `docker logs`                       JSONLog groups per service   log format

  **Monitoring**     Manual (docker stats)No built-in    CloudWatch MetricsCustom     Add metrics in
                     metrics                             dashboardsAlarms             code

  **Networking**     Docker networkAll services can      VPC with subnetsSecurity     More secure in
                     reach each other                    groupsPrivate/public subnets AWS

  **Load Balancing** None (single API instance)          Application Load             Production needs
                                                         BalancerHealth checksSSL     this
                                                         termination                  

  **Auto-scaling**   Manual (`docker-compose scale`)     ECS Service                  Critical for
                                                         auto-scalingBased on         production
                                                         CPU/memory/queue depth       

  **Cost**           Free (except electricity)           Variable                     LocalStack saves
                                                         (\~\$100-500/month)Depends   \$\$ in dev
                                                         on usage                     
  ----------------------------------------------------------------------------------------------------

### Configuration Changes Only

The beauty of this architecture is that **the same code runs
everywhere**. Only configuration changes:

    # backend/config.py
    class Settings(BaseSettings):
        # These values change based on environment
        aws_endpoint_url: str = os.getenv("AWS_ENDPOINT_URL", None)  # None for AWS, "http://localstack:4566" for local
        database_url: str = os.getenv("DATABASE_URL")  # Different per environment
        
        # AWS credentials
        aws_access_key_id: str = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_access_key: str = os.getenv("AWS_SECRET_ACCESS_KEY")
        
        # S3 bucket name
        s3_bucket_name: str = os.getenv("S3_BUCKET_NAME", "data-ingestion-bucket")
        
        # SQS queue name  
        sqs_queue_name: str = os.getenv("SQS_QUEUE_NAME", "data-ingestion-queue")

**Local (.env file):**

    AWS_ENDPOINT_URL=http://localstack:4566
    DATABASE_URL=postgresql://user:password@db:5432/ingestion_db
    AWS_ACCESS_KEY_ID=test
    AWS_SECRET_ACCESS_KEY=test
    S3_BUCKET_NAME=data-ingestion-bucket
    SQS_QUEUE_NAME=data-ingestion-queue

**Production (AWS Secrets Manager):**

    AWS_ENDPOINT_URL=  # Empty = use real AWS
    DATABASE_URL=postgresql://admin:***@db-1.region.rds.amazonaws.com:5432/ingestion_db
    AWS_ACCESS_KEY_ID=AKIA...  # Real AWS credentials from IAM role
    AWS_SECRET_ACCESS_KEY=***
    S3_BUCKET_NAME=prod-data-ingestion
    SQS_QUEUE_NAME=prod-ingestion-queue

## Data Flow Diagrams

### Upload Flow (Step-by-Step)

    ┌─────────┐
    │ Step 1  │  User clicks "Upload CSV" button
    └────┬────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Frontend (React)                               │
    │  - Read file from disk                          │
    │  - Create FormData with file                    │
    │  - POST to /jobs with multipart/form-data       │
    └────┬────────────────────────────────────────────┘
         │
         │ HTTP POST with file
         ▼
    ┌─────────────────────────────────────────────────┐
    │  API (FastAPI)                                  │
    │  1. Validate JWT token (authenticate user)      │
    │  2. Validate file type (.csv only)              │
    │  3. Validate file size (<= 5MB)                 │
    │  4. Create Job record (status=PENDING)          │
    │  5. Generate unique S3 key (uploads/uX/job-Y)   │
    └────┬────────────────────────────────────────────┘
         │
         ├───► PostgreSQL: INSERT INTO jobs (...) RETURNING id
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Storage (S3 / LocalStack)                      │
    │  - Upload file bytes                            │
    │  - Key: uploads/u{user_id}/job-{job_id}.csv     │
    │  - Content-Type: text/csv                       │
    └────┬────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Queue (SQS / LocalStack)                       │
    │  - Publish message:                             │
    │    {                                            │
    │      "job_id": 123,                             │
    │      "file_key": "uploads/u1/job-123.csv"       │
    │    }                                            │
    │  - Message visible immediately                  │
    └────┬────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  API Response to Frontend                       │
    │  {                                              │
    │    "id": 123,                                   │
    │    "status": "PENDING",                         │
    │    "total_rows": 0,                             │
    │    "original_filename": "contacts.csv"          │
    │  }                                              │
    └─────────────────────────────────────────────────┘

    Total time: ~200-500ms
    User sees: Job created, status = PENDING

### Processing Flow (Async Worker)

    ┌─────────┐
    │  Worker │  Infinite loop: poll SQS every 10 seconds
    └────┬────┘
         │
         │ Poll for messages (long polling)
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Queue (SQS)                                    │
    │  - ReceiveMessage(WaitTimeSeconds=10)           │
    │  - Returns message if available                 │
    │  - Sets VisibilityTimeout=300s                  │
    │    (message hidden from other workers)          │
    └────┬────────────────────────────────────────────┘
         │
         │ Message: {"job_id": 123, "file_key": "..."}
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Update Job Status                      │
    │  - UPDATE jobs SET status='PROCESSING'          │
    │  - Frontend polling will see this change        │
    └────┬────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Download CSV from S3                   │
    │  - GetObject(Bucket, Key)                       │
    │  - Read bytes into memory                       │
    │  - Decode UTF-8                                 │
    └────┬────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Parse CSV                              │
    │  - csv.DictReader(csv_text)                     │
    │  - Validate 'email' column exists               │
    │  - Loop through each row                        │
    └────┬────────────────────────────────────────────┘
         │
         │ For each row...
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Validate Row                           │
    │  - Normalize email (lowercase, trim)            │
    │  - Check if empty (MISSING_EMAIL issue)         │
    │  - Check format (INVALID_EMAIL_FORMAT issue)    │
    │  - Check other fields (MISSING_FIRST_NAME, etc) │
    │                                                 │
    │  If valid:                                      │
    │  - INSERT INTO raw_rows (job_id, row_number,    │
    │    data_json, normalized_email, is_valid=true)  │
    │                                                 │
    │  If invalid:                                    │
    │  - INSERT INTO issues (job_id, type, key,       │
    │    payload_json, status=OPEN)                   │
    └────┬────────────────────────────────────────────┘
         │
         │ After all rows processed...
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Detect Duplicates                      │
    │  - GROUP BY normalized_email                    │
    │  - For emails appearing >1 time:                │
    │    - Check if identities differ                 │
    │    - If yes: INSERT INTO issues                 │
    │      (type=DUPLICATE_EMAIL, payload with        │
    │       all candidate rows)                       │
    └────┬────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Update Job Status                      │
    │  - Count issues: SELECT COUNT(*) FROM issues    │
    │    WHERE job_id=X AND status='OPEN'             │
    │                                                 │
    │  If issues > 0:                                 │
    │    - UPDATE jobs SET status='NEEDS_REVIEW',     │
    │      conflict_count=X                           │
    │                                                 │
    │  If issues = 0:                                 │
    │    - Auto-finalize                              │
    │    - UPDATE jobs SET status='COMPLETED'         │
    └────┬────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Worker: Acknowledge Message                    │
    │  - DeleteMessage(QueueUrl, ReceiptHandle)       │
    │  - Message removed from queue                   │
    │  - Worker polls for next message                │
    └─────────────────────────────────────────────────┘

    Total time: 1-30 seconds (depends on file size)
    User sees: Status changes from PENDING → PROCESSING → NEEDS_REVIEW

### Resolution Flow (User Interaction)

    ┌─────────┐
    │  User   │  Sees job with status=NEEDS_REVIEW
    └────┬────┘
         │
         │ 1. GET /jobs/{id}/issues
         ▼
    ┌─────────────────────────────────────────────────┐
    │  API: List Issues                               │
    │  SELECT * FROM issues                           │
    │  WHERE job_id=X AND status='OPEN'               │
    │  JOIN with issue_resolutions (if any)           │
    └────┬────────────────────────────────────────────┘
         │
         │ Returns: [
         │   {
         │     "id": 1,
         │     "type": "DUPLICATE_EMAIL",
         │     "key": "john@example.com",
         │     "payload": {
         │       "candidates": [
         │         {"raw_row_id": 5, "data": {...}},
         │         {"raw_row_id": 12, "data": {...}}
         │       ]
         │     },
         │     "status": "OPEN"
         │   }
         │ ]
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Frontend: Display Issues                       │
    │  - Show candidate rows side-by-side             │
    │  - "Choose" button for each candidate           │
    │  - User clicks "Choose" on Candidate 1          │
    └────┬────────────────────────────────────────────┘
         │
         │ 2. POST /issues/1/resolve
         │    { "chosen_row_id": 5 }
         ▼
    ┌─────────────────────────────────────────────────┐
    │  API: Resolve Issue                             │
    │  1. Validate issue exists and belongs to user   │
    │  2. Validate chosen_row_id is valid candidate   │
    │  3. UPSERT INTO issue_resolutions                │
    │     (issue_id, resolution_json)                 │
    │     VALUES (1, '{"chosen_row_id": 5}')          │
    │  4. UPDATE issues SET status='RESOLVED'         │
    │     WHERE id=1                                  │
    └────┬────────────────────────────────────────────┘
         │
         │ Returns: {"ok": true, "issue_id": 1}
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Frontend: Update UI                            │
    │  - Mark issue as resolved (visual indicator)    │
    │  - Enable "Finalize" button if all resolved     │
    └─────────────────────────────────────────────────┘

    Repeat for each issue...

    ┌─────────┐
    │  User   │  All issues resolved, clicks "Finalize"
    └────┬────┘
         │
         │ 3. POST /jobs/{id}/finalize
         ▼
    ┌─────────────────────────────────────────────────┐
    │  API: Finalize Job                              │
    │  1. Verify no open issues remain                │
    │  2. DELETE FROM final_contacts WHERE job_id=X   │
    │  3. For each email:                             │
    │     - If resolved issue exists:                 │
    │       Use chosen_row_id                         │
    │     - Else:                                     │
    │       Use first valid row                       │
    │  4. INSERT INTO final_contacts                  │
    │     (job_id, email, first_name, last_name, ...)│
    │  5. UPDATE jobs SET status='COMPLETED'          │
    └────┬────────────────────────────────────────────┘
         │
         │ Returns: {"ok": true, "status": "COMPLETED"}
         ▼
    ┌─────────────────────────────────────────────────┐
    │  Frontend: Show Success                         │
    │  - Job status = COMPLETED                       │
    │  - Show final contact count                     │
    │  - Option to download/view final data           │
    └─────────────────────────────────────────────────┘

## Deployment Patterns

### Local Development Workflow

    # 1. Start all services
    docker compose up --build

    # Services start in order (thanks to depends_on and healthchecks):
    # 1. PostgreSQL (db)
    # 2. LocalStack (localstack)
    # 3. API (api)
    # 4. Worker (worker)
    # 5. Frontend (frontend)

    # 2. Access application
    open http://localhost:5173

    # 3. View logs (separate terminals)
    docker compose logs -f api
    docker compose logs -f worker

    # 4. Check LocalStack
    aws --endpoint-url=http://localhost:4566 s3 ls
    aws --endpoint-url=http://localhost:4566 sqs list-queues

    # 5. Database access
    docker compose exec db psql -U user -d ingestion_db

### AWS Production Deployment (Option 1: ECS/Fargate)

    # 1. Build and push Docker images
    docker build -t my-registry/data-ingestion-api:latest ./backend
    docker push my-registry/data-ingestion-api:latest

    docker build -t my-registry/data-ingestion-worker:latest ./backend
    docker push my-registry/data-ingestion-worker:latest

    # 2. Create infrastructure (Terraform example)
    cd terraform/
    terraform init
    terraform apply

    # Creates:
    # - VPC with public/private subnets
    # - RDS PostgreSQL instance
    # - S3 bucket with lifecycle policies
    # - SQS queue with DLQ
    # - ECS cluster
    # - ECS task definitions (API, Worker)
    # - ECS services with auto-scaling
    # - Application Load Balancer
    # - CloudWatch log groups

    # 3. Deploy API service
    aws ecs update-service \
      --cluster data-ingestion-cluster \
      --service api-service \
      --force-new-deployment

    # 4. Deploy Worker service
    aws ecs update-service \
      --cluster data-ingestion-cluster \
      --service worker-service \
      --force-new-deployment

    # 5. Build and deploy frontend
    cd frontend/
    npm run build
    aws s3 sync dist/ s3://my-frontend-bucket/
    aws cloudfront create-invalidation --distribution-id XXX --paths "/*"

### AWS Production Deployment (Option 2: Lambda Worker)

    # 1. Package Lambda function
    cd backend/
    pip install -r requirements.txt -t lambda_package/
    cp *.py lambda_package/
    cd lambda_package/
    zip -r ../worker-lambda.zip .

    # 2. Deploy Lambda
    aws lambda update-function-code \
      --function-name csv-worker \
      --zip-file fileb://../worker-lambda.zip

    # 3. Configure SQS trigger
    aws lambda create-event-source-mapping \
      --function-name csv-worker \
      --event-source-arn arn:aws:sqs:region:account:prod-ingestion-queue \
      --batch-size 10 \
      --maximum-batching-window-in-seconds 5

## Summary: Why This Architecture?

### Benefits of Local/AWS Parity

1.  **Same Code Everywhere**
    -   Reduces "works on my machine" problems
    -   Confidence that local tests match production behavior
2.  **Fast Development**
    -   No AWS account needed for development
    -   No network latency
    -   No AWS costs during development
    -   Full stack runs on laptop
3.  **Cloud-Ready**
    -   boto3 SDK works with both LocalStack and AWS
    -   SQLAlchemy works with both local and RDS Postgres
    -   Only configuration changes needed
4.  **Testing & CI/CD**
    -   Can run full integration tests in CI pipeline
    -   Use LocalStack in GitHub Actions/GitLab CI
    -   No need for separate "test AWS account"
5.  **Cost Optimization**
    -   Develop locally (free)
    -   Deploy to AWS only when ready
    -   Can estimate AWS costs before going live

### Migration Path: Local → AWS

**Phase 1: Local Development** (You are here) - Everything runs in
Docker Compose - LocalStack for S3/SQS - Local PostgreSQL

**Phase 2: Hybrid (Optional)** - Keep API/Worker local - Use real AWS
S3/SQS - Test AWS integration without full deployment

**Phase 3: Staging Environment** - Deploy to AWS in separate "staging"
account - Same infrastructure as production - Test deployment process

**Phase 4: Production** - Deploy to production AWS account - Set up
monitoring, alarms, backups - Blue/green deployment for zero downtime

## Next Steps

For your presentation, you can:

1.  **Show local architecture** (Docker Compose diagram)
2.  **Explain each component** (what it does)
3.  **Show production mapping** (AWS services)
4.  **Highlight key point:** "Same code, different configuration"
5.  **Emphasize:** "This demonstrates production thinking even in a
    local project"

The architecture shows you understand: - Event-driven design - Async
processing - Decoupling (API vs Worker vs Storage) - Scalability (can
run multiple workers) - Production readiness (monitoring, logging, error
handling) - Cost consciousness (LocalStack for dev)
