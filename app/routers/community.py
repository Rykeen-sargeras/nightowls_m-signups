from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import MemberProfile, User
from app.routers.auth import require_user, require_admin

router = APIRouter()

BIO_CHAR_LIMIT = 750


class ProfileCreate(BaseModel):
    display_name: str
    main_class: str = ""
    guild_rank: str = ""
    bio: str = ""
    profile_image: str = ""  # base64 string


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    main_class: Optional[str] = None
    guild_rank: Optional[str] = None
    bio: Optional[str] = None
    profile_image: Optional[str] = None


class SeedUpdate(BaseModel):
    user_id: int
    seed: int


@router.get("/")
async def get_all_profiles(db: AsyncSession = Depends(get_db)):
    """Get all community profiles, sorted by seed (lower first)."""
    result = await db.execute(
        select(MemberProfile).order_by(MemberProfile.seed, MemberProfile.created_at)
    )
    profiles = result.scalars().all()
    return {
        "profiles": [
            {
                "id": p.id,
                "user_id": p.user_id,
                "display_name": p.display_name,
                "main_class": p.main_class,
                "guild_rank": p.guild_rank,
                "bio": p.bio,
                "profile_image": p.profile_image,
                "seed": p.seed,
            }
            for p in profiles
        ]
    }


@router.post("/")
async def create_profile(req: ProfileCreate, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    """Create a profile for the logged-in user."""
    # Check if profile already exists
    existing = await db.execute(
        select(MemberProfile).where(MemberProfile.user_id == user.id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already have a profile. Use edit instead.")

    # Enforce bio limit for non-admins
    bio = req.bio
    if not user.is_admin and len(bio) > BIO_CHAR_LIMIT:
        bio = bio[:BIO_CHAR_LIMIT]

    profile = MemberProfile(
        user_id=user.id,
        display_name=req.display_name,
        main_class=req.main_class,
        guild_rank=req.guild_rank,
        bio=bio,
        profile_image=req.profile_image,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return {"success": True, "message": "Profile created", "id": profile.id}


@router.put("/")
async def update_profile(req: ProfileUpdate, user: User = Depends(require_user), db: AsyncSession = Depends(get_db)):
    """Update the logged-in user's profile."""
    result = await db.execute(
        select(MemberProfile).where(MemberProfile.user_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="No profile found. Create one first.")

    if req.display_name is not None:
        profile.display_name = req.display_name
    if req.main_class is not None:
        profile.main_class = req.main_class
    if req.guild_rank is not None:
        profile.guild_rank = req.guild_rank
    if req.bio is not None:
        bio = req.bio
        if not user.is_admin and len(bio) > BIO_CHAR_LIMIT:
            bio = bio[:BIO_CHAR_LIMIT]
        profile.bio = bio
    if req.profile_image is not None:
        profile.profile_image = req.profile_image

    await db.commit()
    return {"success": True, "message": "Profile updated"}


@router.delete("/{profile_id}")
async def delete_profile(profile_id: int, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Delete a profile (admin only)."""
    result = await db.execute(select(MemberProfile).where(MemberProfile.id == profile_id))
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    await db.delete(profile)
    await db.commit()
    return {"success": True, "message": "Profile deleted"}


@router.put("/seed")
async def update_seed(req: SeedUpdate, user: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """Update a member's position seed (admin only)."""
    result = await db.execute(
        select(MemberProfile).where(MemberProfile.user_id == req.user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.seed = req.seed
    await db.commit()
    return {"success": True, "message": f"Seed updated to {req.seed}"}
