from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.models import ArchivedPlayer, EventState, Player
from app.models.schemas import (
    AdminRequest,
    ClassSpecResponse,
    PlayerOut,
    RosterResponse,
    SignupRequest,
    SignupResponse,
    VALID_SPECS,
    get_specs_for_class,
)

router = APIRouter()


@router.get("/specs", response_model=ClassSpecResponse)
async def get_class_specs():
    return ClassSpecResponse(classes=VALID_SPECS)


@router.get("/attendance")
async def get_attendance(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            ArchivedPlayer.username,
            func.count(ArchivedPlayer.id).label("events"),
            func.max(ArchivedPlayer.event_date).label("last_event"),
        ).group_by(ArchivedPlayer.username)
        .order_by(func.count(ArchivedPlayer.id).desc())
    )
    rows = result.all()
    return {
        "attendance": [
            {
                "username": row.username,
                "events": row.events,
                "last_event": row.last_event.isoformat() if row.last_event else None,
            }
            for row in rows
        ]
    }


@router.delete("/attendance/{username}")
async def delete_attendance(username: str, req: AdminRequest, db: AsyncSession = Depends(get_db)):
    from app.routers.admin import _verify_password
    _verify_password(req.password)

    result = await db.execute(select(ArchivedPlayer).where(ArchivedPlayer.username.ilike(username)))
    records = result.scalars().all()
    if not records:
        raise HTTPException(status_code=404, detail="No attendance records found")

    for r in records:
        await db.delete(r)
    await db.commit()
    return {"success": True, "message": f"Deleted {len(records)} records for {username}"}


@router.get("/roster", response_model=RosterResponse)
async def get_roster(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Player).order_by(Player.signed_up_at))
    players = result.scalars().all()
    state = await _get_event_state(db)
    return RosterResponse(players=[PlayerOut.model_validate(p) for p in players], is_locked=state.is_locked if state else False)


@router.post("/signup", response_model=SignupResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    state = await _get_event_state(db)
    if state and state.is_locked:
        raise HTTPException(status_code=403, detail="Signups are locked")

    specs = get_specs_for_class(req.wow_class)
    if req.specialization not in specs:
        raise HTTPException(status_code=400, detail=f"{req.specialization} is not a valid spec for {req.wow_class}")

    role = specs[req.specialization]
    existing = await db.execute(select(Player).where(Player.username.ilike(req.username)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Character name already signed up")

    player = Player(username=req.username, wow_class=req.wow_class, specialization=req.specialization, role=role)
    db.add(player)
    await db.commit()
    await db.refresh(player)
    return SignupResponse(success=True, message=f"{req.username} signed up as {req.wow_class} {req.specialization} ({role})", player=PlayerOut.model_validate(player))


@router.delete("/signup/{username}", response_model=SignupResponse)
async def cancel_signup(username: str, db: AsyncSession = Depends(get_db)):
    state = await _get_event_state(db)
    if state and state.is_locked:
        raise HTTPException(status_code=403, detail="Signups are locked")

    result = await db.execute(select(Player).where(Player.username.ilike(username)))
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    await db.delete(player)
    await db.commit()
    return SignupResponse(success=True, message=f"{username} removed")


async def _get_event_state(db: AsyncSession) -> EventState | None:
    result = await db.execute(select(EventState).where(EventState.id == 1))
    return result.scalar_one_or_none()
