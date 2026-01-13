from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class JobOut(BaseModel):
    id: int
    status: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    conflict_count: int
    error_message: Optional[str] = None

class ResolveIssueIn(BaseModel):
    action: str = "choose"
    chosen_row_id: int
