from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.models import Video
from app.routers.admin import _verify_password

router = APIRouter()


class VideoCreate(BaseModel):
    password: str
    category: str
    boss_name: str
    description: str = ""
    youtube_url: str
    sort_order: int = 0


class VideoUpdate(BaseModel):
    password: str
    boss_name: Optional[str] = None
    description: Optional[str] = None
    youtube_url: Optional[str] = None
    sort_order: Optional[int] = None


class VideoDelete(BaseModel):
    password: str


@router.get("/")
async def get_videos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).order_by(Video.category, Video.sort_order, Video.created_at))
    videos = result.scalars().all()
    raid = []
    mythicplus = []
    for v in videos:
        entry = {
            "id": v.id,
            "category": v.category,
            "boss_name": v.boss_name,
            "description": v.description,
            "youtube_url": v.youtube_url,
            "sort_order": v.sort_order,
        }
        if v.category == "raid":
            raid.append(entry)
        else:
            mythicplus.append(entry)
    return {"raid": raid, "mythicplus": mythicplus}


@router.post("/")
async def create_video(req: VideoCreate, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    if req.category not in ("raid", "mythicplus"):
        raise HTTPException(status_code=400, detail="Category must be 'raid' or 'mythicplus'")
    video = Video(category=req.category, boss_name=req.boss_name, description=req.description, youtube_url=req.youtube_url, sort_order=req.sort_order)
    db.add(video)
    await db.commit()
    await db.refresh(video)
    return {"success": True, "message": f"Added '{req.boss_name}' to {req.category}", "id": video.id}


@router.put("/{video_id}")
async def update_video(video_id: int, req: VideoUpdate, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    if req.boss_name is not None:
        video.boss_name = req.boss_name
    if req.description is not None:
        video.description = req.description
    if req.youtube_url is not None:
        video.youtube_url = req.youtube_url
    if req.sort_order is not None:
        video.sort_order = req.sort_order
    await db.commit()
    return {"success": True, "message": f"Updated '{video.boss_name}'"}


@router.delete("/{video_id}")
async def delete_video(video_id: int, req: VideoDelete, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(Video).where(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    name = video.boss_name
    await db.delete(video)
    await db.commit()
    return {"success": True, "message": f"Deleted '{name}'"}
