import os
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.database import get_db
from app.models.models import Player, EventState, ArchivedPlayer
from app.models.schemas import AdminRequest

router = APIRouter()
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "nightowls2024")


def _verify_password(password: str):
    if password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password")


@router.post("/verify")
async def verify_admin(req: AdminRequest):
    _verify_password(req.password)
    return {"success": True}


@router.post("/lock")
async def lock_signups(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    state = await _get_or_create_state(db)
    state.is_locked = True
    state.locked_at = func.now()
    await db.commit()
    return {"success": True, "message": "Signups locked"}


@router.post("/unlock")
async def unlock_signups(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    state = await _get_or_create_state(db)
    state.is_locked = False
    state.locked_at = None
    result = await db.execute(select(Player))
    for player in result.scalars().all():
        player.group_index = ""
    await db.commit()
    return {"success": True, "message": "Signups unlocked, groups cleared"}


@router.post("/archive")
async def archive_and_reset(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(Player))
    players = result.scalars().all()
    for p in players:
        db.add(ArchivedPlayer(
            username=p.username, wow_class=p.wow_class,
            specialization=p.specialization, role=p.role, group_index=p.group_index,
        ))
    await db.execute(delete(Player))
    state = await _get_or_create_state(db)
    state.is_locked = False
    state.locked_at = None
    await db.commit()
    return {"success": True, "message": f"Archived {len(players)} players, roster reset"}


async def _get_or_create_state(db: AsyncSession) -> EventState:
    result = await db.execute(select(EventState).where(EventState.id == 1))
    state = result.scalar_one_or_none()
    if not state:
        state = EventState(id=1, is_locked=False)
        db.add(state)
        await db.flush()
    return state
