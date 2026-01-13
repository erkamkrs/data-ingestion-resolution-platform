from datetime import datetime, timedelta, timezone
from jose import jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import User

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/auth/login")

def hash_password(p: str) -> str:
    return pwd.hash(p)

def verify_password(p: str, h: str) -> bool:
    return pwd.verify(p, h)

def create_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_exp_minutes)
    return jwt.encode({"sub": str(user_id), "exp": exp}, settings.jwt_secret, algorithm=settings.jwt_algo)

def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algo])
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
