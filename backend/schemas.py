from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Any

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)

# Using the OAuth2PasswordRequestForm from FastAPI for login, so LoginIn schema is not needed anymore.
# class LoginIn(BaseModel):
#     email: EmailStr
#     password: str = Field(min_length=8, max_length=64)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ApplicationOut(BaseModel):
    id: int
    status: str
    total_rows: int
    valid_rows: int
    invalid_rows: int
    conflict_count: int
    error_message: Optional[str] = None
    original_filename: Optional[str] = None

class ResolveIssueIn(BaseModel):
    action: str = "choose"
    chosen_row_id: int
