from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str
    aws_endpoint_url: str
    aws_default_region: str = "us-east-1"
    aws_access_key_id: str = "test"
    aws_secret_access_key: str = "test"

    s3_bucket: str
    sqs_queue_name: str

    jwt_secret: str
    jwt_algo: str = "HS256"
    jwt_exp_minutes: int = 60 * 24

settings = Settings()
