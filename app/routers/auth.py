import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.models import User
from app.models.schemas import AuthLoginRequest, AuthResponse, AuthSignupRequest, UserOut
from app.services.security import create_token, get_current_user, hash_password, verify_password

router = APIRouter()
ADMIN_EMAILS = {email.strip().lower() for email in os.getenv("ADMIN_EMAILS", "").split(",") if email.strip()}


@router.post("/signup", response_model=AuthResponse)
async def signup(req: AuthSignupRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="That email is already registered")

    is_admin = req.email.lower() in ADMIN_EMAILS
    user = User(email=req.email.lower(), password_hash=hash_password(req.password), is_admin=is_admin)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return AuthResponse(token=create_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: AuthLoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email.lower()))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return AuthResponse(token=create_token(user), user=UserOut.model_validate(user))


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {"user": UserOut.model_validate(current_user)}
