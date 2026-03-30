from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.models import SiteContent, User
from app.routers.auth import get_current_user
from app.routers.admin import _verify_password

router = APIRouter()


class ContentUpdate(BaseModel):
    value: str


@router.get("/{key}")
async def get_content(key: str, db: AsyncSession = Depends(get_db)):
    """Get site content by key. Public endpoint."""
    result = await db.execute(
        select(SiteContent).where(SiteContent.content_key == key)
    )
    content = result.scalar_one_or_none()
    if not content:
        return {"key": key, "value": ""}
    return {"key": content.content_key, "value": content.content_value}


@router.put("/{key}")
async def update_content(
    key: str,
    req: ContentUpdate,
    authorization: Optional[str] = Header(None),
    x_admin_password: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """Update site content (admin only). Supports JWT admins and legacy admin-password flow."""
    user = await get_current_user(authorization, db)
    if user and user.is_admin:
        pass
    elif x_admin_password:
        _verify_password(x_admin_password)
    else:
        raise HTTPException(status_code=403, detail="Admin access required")
    result = await db.execute(
        select(SiteContent).where(SiteContent.content_key == key)
    )
    content = result.scalar_one_or_none()
    if content:
        content.content_value = req.value
    else:
        content = SiteContent(content_key=key, content_value=req.value)
        db.add(content)
    await db.commit()
    return {"success": True, "message": f"Content '{key}' updated"}
