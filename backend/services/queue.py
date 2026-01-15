import json
import boto3
from config import settings

def sqs_client():
    return boto3.client(
        "sqs",
        endpoint_url=settings.aws_endpoint_url,
        region_name=settings.aws_default_region,
        aws_access_key_id=settings.aws_access_key_id,
        aws_secret_access_key=settings.aws_secret_access_key,
    )

def get_queue_url() -> str:
    client = sqs_client()
    return client.get_queue_url(QueueName=settings.sqs_queue_name)["QueueUrl"]

def publish_job(application_id: int, file_key: str) -> None:
    client = sqs_client()
    queue_url = get_queue_url()
    client.send_message(
        QueueUrl=queue_url,
        MessageBody=json.dumps({"application_id": application_id, "file_key": file_key}),
    )

def poll_messages(max_messages: int = 1, wait_seconds: int = 10):
    client = sqs_client()
    queue_url = get_queue_url()
    resp = client.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=max_messages,
        WaitTimeSeconds=wait_seconds,
        VisibilityTimeout=30,
    )
    return resp.get("Messages", []), queue_url

def delete_message(queue_url: str, receipt_handle: str) -> None:
    client = sqs_client()
    client.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt_handle)
