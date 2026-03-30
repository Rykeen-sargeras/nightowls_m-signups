import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.models import CommunityMember, User
from app.models.schemas import CommunityMemberOut, CommunitySeedBulkRequest
from app.services.security import get_admin_user, get_current_user

router = APIRouter()
ROOT_DIR = Path(__file__).resolve().parents[2]
COMMUNITY_UPLOAD_DIR = ROOT_DIR / "static" / "uploads" / "community"
COMMUNITY_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def _public_path(filename: str) -> str:
    return f"/static/uploads/community/{filename}"


def _remove_existing_file(public_path: str | None):
    if not public_path:
        return
    filename = Path(public_path).name
    file_path = COMMUNITY_UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()


@router.get("/")
async def list_members(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CommunityMember).order_by(CommunityMember.position_seed, CommunityMember.created_at))
    members = result.scalars().all()
    return {"members": [CommunityMemberOut.model_validate(member) for member in members]}


@router.get("/me")
async def get_my_member(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CommunityMember).where(CommunityMember.user_id == current_user.id))
    member = result.scalar_one_or_none()
    return {"member": CommunityMemberOut.model_validate(member) if member else None}


@router.post("/profile")
async def upsert_profile(
    name: str = Form(...),
    main_class: str = Form(...),
    guild_rank: str = Form(""),
    bio: str = Form(""),
    image: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    clean_name = name.strip()
    clean_class = main_class.strip()
    clean_rank = guild_rank.strip() or None
    clean_bio = bio.strip()

    if len(clean_name) < 2 or len(clean_name) > 60:
        raise HTTPException(status_code=400, detail="Name must be 2-60 characters")
    if len(clean_class) < 2 or len(clean_class) > 50:
        raise HTTPException(status_code=400, detail="Main class is required")
    if clean_rank and len(clean_rank) > 80:
        raise HTTPException(status_code=400, detail="Guild rank must be 80 characters or less")
    if not current_user.is_admin and len(clean_bio) > 750:
        raise HTTPException(status_code=400, detail="Bio must be 750 characters or less")

    result = await db.execute(select(CommunityMember).where(CommunityMember.user_id == current_user.id))
    member = result.scalar_one_or_none()
    if not member:
        max_seed_result = await db.execute(select(CommunityMember.position_seed).order_by(CommunityMember.position_seed.desc()).limit(1))
        max_seed = max_seed_result.scalar_one_or_none()
        member = CommunityMember(user_id=current_user.id, position_seed=(max_seed + 10 if max_seed is not None else 10))
        db.add(member)
        await db.flush()

    member.name = clean_name
    member.main_class = clean_class
    member.guild_rank = clean_rank
    member.bio = clean_bio

    if image and image.filename:
        ext = Path(image.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Profile image must be PNG, JPG, JPEG, WEBP, or GIF")
        filename = f"{uuid.uuid4().hex}{ext}"
        target = COMMUNITY_UPLOAD_DIR / filename
        with target.open("wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
        _remove_existing_file(member.image_path)
        member.image_path = _public_path(filename)

    await db.commit()
    await db.refresh(member)
    return {"success": True, "member": CommunityMemberOut.model_validate(member)}


@router.post("/reorder")
async def reorder_members(req: CommunitySeedBulkRequest, admin_user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    ids = [item.member_id for item in req.seeds]
    result = await db.execute(select(CommunityMember).where(CommunityMember.id.in_(ids)))
    members = {m.id: m for m in result.scalars().all()}
    updated = 0
    for item in req.seeds:
        member = members.get(item.member_id)
        if member:
            member.position_seed = item.position_seed
            updated += 1
    await db.commit()
    return {"success": True, "message": f"Updated {updated} member positions"}
