#!/bin/bash
set -e

awslocal s3 mb s3://contact-imports || true
awslocal sqs create-queue --queue-name contact-import-jobs || true

echo "LocalStack initialized: bucket=contact-imports, queue=contact-import-jobs"
