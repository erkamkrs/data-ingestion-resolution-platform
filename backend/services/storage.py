import boto3
from config import settings

def s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.aws_endpoint_url,
        region_name=settings.aws_default_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

def upload_bytes(file_bytes: bytes, key: str) -> str:
    client = s3_client()
    client.put_object(Bucket=settings.s3_bucket, Key=key, Body=file_bytes)
    return key

def download_bytes(key: str) -> bytes:
    client = s3_client()
    obj = client.get_object(Bucket=settings.s3_bucket, Key=key)
    return obj["Body"].read()
