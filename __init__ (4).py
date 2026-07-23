from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, field_validator
from typing import Optional
from app.database import get_db
from app.models.models import User
from app.services.auth import hash_password, verify_password, create_token, decode_token
from app.routers.admin import _verify_password as verify_admin_password

router = APIRouter()

DEFAULT_RESET_PASSWORD = "owl123"


class RegisterRequest(BaseModel):
    username: str
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


class ChangePasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class AdminResetRequest(BaseModel):
    admin_password: str
    user_id: int


async def get_current_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> Optional[User]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ", 1)[1]
    payload = decode_token(token)
    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def require_user(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    user = await get_current_user(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Login required")
    return user


async def require_admin(authorization: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> User:
    user = await require_user(authorization, db)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.post("/register")
async def register(req: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
        existing = await db.execute(select(User).where(User.username.ilike(req.username.strip())))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")

        pw_hash = hash_password(req.password)

        user = User(
            username=req.username.strip(),
            password_hash=pw_hash,
            is_admin=False,
            password_reset_required=False,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Register failed: {str(e)}")

    token = create_token(user.id, user.username, user.is_admin)
    return {
        "success": True,
        "message": f"Welcome, {user.username}!",
        "token": token,
        "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin, "password_reset_required": False},
    }


@router.post("/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(User).where(User.username.ilike(req.username.strip())))
        user = result.scalar_one_or_none()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login query failed: {str(e)}")

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(user.id, user.username, user.is_admin)
    return {
        "success": True,
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "is_admin": user.is_admin,
            "password_reset_required": user.password_reset_required,
        },
    }


@router.get("/me")
async def get_me(user: User = Depends(require_user)):
    return {
        "id": user.id,
        "username": user.username,
        "is_admin": user.is_admin,
        "password_reset_required": user.password_reset_required,
    }


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    """Change the logged-in user's password. Also clears the reset flag."""
    user.password_hash = hash_password(req.new_password)
    user.password_reset_required = False
    await db.commit()
    return {"success": True, "message": "Password changed successfully"}


# === ADMIN ENDPOINTS ===

@router.post("/members")
async def get_member_list(req: dict, db: AsyncSession = Depends(get_db)):
    """Get all registered users (admin only). Requires admin_password in body."""
    verify_admin_password(req.get("admin_password", ""))
    result = await db.execute(select(User).order_by(User.created_at))
    users = result.scalars().all()
    return {
        "members": [
            {
                "id": u.id,
                "username": u.username,
                "is_admin": u.is_admin,
                "password_reset_required": u.password_reset_required,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
    }


@router.post("/reset-password")
async def reset_password(req: AdminResetRequest, db: AsyncSession = Depends(get_db)):
    """Reset a user's password to 'owl123' (admin only)."""
    verify_admin_password(req.admin_password)
    result = await db.execute(select(User).where(User.id == req.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(DEFAULT_RESET_PASSWORD)
    user.password_reset_required = True
    await db.commit()
    return {"success": True, "message": f"Password for {user.username} reset to '{DEFAULT_RESET_PASSWORD}'"}
