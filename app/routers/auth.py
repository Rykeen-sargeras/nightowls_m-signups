from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from typing import Optional
from app.database import get_db
from app.models.models import User
from app.services.auth import hash_password, verify_password, create_token, decode_token

router = APIRouter()


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v):
        v = v.strip()
        if len(v) < 3 or len(v) > 50:
            raise ValueError("Username must be 3-50 characters")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    username: str
    password: str


async def get_current_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> Optional[User]:
    """Extract user from JWT token in Authorization header. Returns None if no token."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    return user


async def require_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    """Like get_current_user but raises 401 if not logged in."""
    user = await get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    return user


async def require_admin(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    """Requires logged-in admin user."""
    user = await require_user(authorization, db)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicates
    existing = await db.execute(select(User).where(
        (User.username.ilike(req.username)) | (User.email.ilike(req.email))
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username or email already taken")

    user = User(
        username=req.username,
        email=req.email,
        password_hash=hash_password(req.password),
        is_admin=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_token(user.id, user.username, user.is_admin)
    return {
        "success": True,
        "message": f"Welcome, {user.username}!",
        "token": token,
        "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin},
    }


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username.ilike(req.username)))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(user.id, user.username, user.is_admin)
    return {
        "success": True,
        "token": token,
        "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin},
    }


@router.get("/me")
async def get_me(user: User = Depends(require_user)):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
    }
