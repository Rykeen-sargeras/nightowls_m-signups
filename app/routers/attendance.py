from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func, distinct
from pydantic import BaseModel
from app.database import get_db
from app.models.models import ArchivedPlayer
from app.routers.admin import _verify_password

router = APIRouter()


class DeleteAttendanceRequest(BaseModel):
    password: str


@router.get("/")
async def get_attendance(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            ArchivedPlayer.username,
            func.count(ArchivedPlayer.id).label("events"),
            func.max(ArchivedPlayer.event_date).label("last_event"),
        )
        .where(ArchivedPlayer.group_index != "Bench")
        .group_by(ArchivedPlayer.username)
        .order_by(func.count(ArchivedPlayer.id).desc())
    )
    rows = result.all()
    attendance = [
        {"username": row.username, "events": row.events, "last_event": row.last_event.isoformat() if row.last_event else None}
        for row in rows
    ]
    return {"attendance": attendance}


@router.get("/history")
async def get_archive_history(db: AsyncSession = Depends(get_db)):
    """Return all unique archived event dates with their event types."""
    result = await db.execute(
        select(
            ArchivedPlayer.event_date,
            ArchivedPlayer.event_type,
            func.count(ArchivedPlayer.id).label("player_count"),
        )
        .group_by(ArchivedPlayer.event_date, ArchivedPlayer.event_type)
        .order_by(ArchivedPlayer.event_date.desc())
    )
    rows = result.all()
    events = [
        {
            "event_date": row.event_date.isoformat() if row.event_date else None,
            "event_type": row.event_type or "mythicplus",
            "player_count": row.player_count,
        }
        for row in rows
    ]
    return {"events": events}


@router.get("/history/{event_date}")
async def get_archive_event(event_date: str, event_type: str = "mythicplus", db: AsyncSession = Depends(get_db)):
    """Return all players from a specific archived event."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(event_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    result = await db.execute(
        select(ArchivedPlayer)
        .where(ArchivedPlayer.event_date == dt)
        .where(ArchivedPlayer.event_type == event_type)
        .order_by(ArchivedPlayer.group_index, ArchivedPlayer.role)
    )
    players = result.scalars().all()

    player_list = [
        {
            "username": p.username,
            "wow_class": p.wow_class,
            "specialization": p.specialization,
            "role": p.role,
            "group_index": p.group_index or "",
            "event_type": p.event_type or "mythicplus",
            "signup_status": p.signup_status or "available",
        }
        for p in players
    ]
    return {"players": player_list, "event_date": event_date, "event_type": event_type}


@router.delete("/{username}")
async def delete_attendance(username: str, req: DeleteAttendanceRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(func.count(ArchivedPlayer.id)).where(ArchivedPlayer.username.ilike(username)))
    count = result.scalar() or 0
    if count == 0:
        raise HTTPException(status_code=404, detail=f"No records found for {username}")
    await db.execute(delete(ArchivedPlayer).where(ArchivedPlayer.username.ilike(username)))
    await db.commit()
    return {"success": True, "message": f"Deleted {count} records for {username}"}
