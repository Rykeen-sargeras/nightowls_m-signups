from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from pydantic import BaseModel
from app.database import get_db
from app.models.models import ArchivedPlayer
from app.routers.admin import _verify_password

router = APIRouter()


class DeleteAttendanceRequest(BaseModel):
    password: str


@router.get("/")
async def get_attendance(db: AsyncSession = Depends(get_db)):
    """
    Get attendance leaderboard — aggregated from archived_players.
    Returns each unique player with their event count and last event date,
    sorted by most events descending.
    """
    result = await db.execute(
        select(
            ArchivedPlayer.username,
            func.count(ArchivedPlayer.id).label("events"),
            func.max(ArchivedPlayer.event_date).label("last_event"),
        )
        .where(ArchivedPlayer.group_index != "Bench")  # Only count players who actually played, not benched
        .group_by(ArchivedPlayer.username)
        .order_by(func.count(ArchivedPlayer.id).desc())
    )
    rows = result.all()

    attendance = [
        {
            "username": row.username,
            "events": row.events,
            "last_event": row.last_event.isoformat() if row.last_event else None,
        }
        for row in rows
    ]

    return {"attendance": attendance}


@router.delete("/{username}")
async def delete_attendance(username: str, req: DeleteAttendanceRequest, db: AsyncSession = Depends(get_db)):
    """Delete ALL archived records for a player. Admin only."""
    _verify_password(req.password)

    result = await db.execute(
        select(func.count(ArchivedPlayer.id))
        .where(ArchivedPlayer.username.ilike(username))
    )
    count = result.scalar() or 0

    if count == 0:
        raise HTTPException(status_code=404, detail=f"No attendance records found for {username}")

    await db.execute(
        delete(ArchivedPlayer).where(ArchivedPlayer.username.ilike(username))
    )
    await db.commit()

    return {"success": True, "message": f"Deleted {count} records for {username}"}
