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
    """
    Flexible issue resolution supporting multiple resolution types:
    
    1. For DUPLICATE_EMAIL issues:
       - action: "choose"
       - chosen_row_id: which row to keep
    
    2. For MISSING_* and INVALID_EMAIL_FORMAT issues:
       - action: "edit"
       - row_id: which row to update
       - updated_data: dict with corrected fields
         Example: {"email": "correct@example.com", "first_name": "John"}
    
    3. For any issue:
       - action: "skip"
       - (user decided this row is not valuable, skip it)
    """
    action: str  # "choose", "edit", or "skip"
    chosen_row_id: Optional[int] = None  # For DUPLICATE_EMAIL: which row to keep
    row_id: Optional[int] = None  # For field editing: which row to update
    updated_data: Optional[dict[str, Any]] = None  # For field editing: corrected field values

