import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.models import SiteSetting, User
from app.services.security import get_admin_user

router = APIRouter()
ROOT_DIR = Path(__file__).resolve().parents[2]
BANNER_UPLOAD_DIR = ROOT_DIR / "static" / "uploads" / "banners"
BANNER_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def _public_path(filename: str) -> str:
    return f"/static/uploads/banners/{filename}"


async def _get_setting(db: AsyncSession, key: str) -> SiteSetting | None:
    result = await db.execute(select(SiteSetting).where(SiteSetting.key == key))
    return result.scalar_one_or_none()


async def _set_setting(db: AsyncSession, key: str, value: str):
    setting = await _get_setting(db, key)
    if not setting:
        setting = SiteSetting(key=key, value=value)
        db.add(setting)
    else:
        setting.value = value
    await db.flush()
    return setting


def _remove_existing_file(public_path: str | None):
    if not public_path:
        return
    filename = Path(public_path).name
    path = BANNER_UPLOAD_DIR / filename
    if path.exists():
        path.unlink()


@router.get("/")
async def get_rules(db: AsyncSession = Depends(get_db)):
    rules_setting = await _get_setting(db, "rules_content")
    rules_banner = await _get_setting(db, "rules_banner")
    community_banner = await _get_setting(db, "community_banner")
    return {
        "content": rules_setting.value if rules_setting else "",
        "rules_banner": rules_banner.value if rules_banner else None,
        "community_banner": community_banner.value if community_banner else None,
    }


@router.post("/content")
async def save_rules(content: str = Form(""), admin_user: User = Depends(get_admin_user), db: AsyncSession = Depends(get_db)):
    await _set_setting(db, "rules_content", content)
    await db.commit()
    return {"success": True, "message": "Rules updated"}


@router.post("/banner/{banner_type}")
async def upload_banner(
    banner_type: str,
    image: UploadFile = File(...),
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    if banner_type not in {"rules", "community"}:
        raise HTTPException(status_code=400, detail="Banner type must be 'rules' or 'community'")
    ext = Path(image.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Banner image must be PNG, JPG, JPEG, WEBP, or GIF")
    key = f"{banner_type}_banner"
    existing = await _get_setting(db, key)
    filename = f"{banner_type}-{uuid.uuid4().hex}{ext}"
    target = BANNER_UPLOAD_DIR / filename
    with target.open("wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    if existing:
        _remove_existing_file(existing.value)
    await _set_setting(db, key, _public_path(filename))
    await db.commit()
    return {"success": True, "message": f"{banner_type.title()} banner updated", "path": _public_path(filename)}
