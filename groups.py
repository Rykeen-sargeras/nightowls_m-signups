from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Player, EventState
from app.models.schemas import (
    SignupRequest, SignupResponse, PlayerOut, RosterResponse,
    ClassSpecResponse, VALID_SPECS, get_specs_for_class
)

router = APIRouter()


def _assign_signup_numbers(players, event_type: str = None) -> list[PlayerOut]:
    """Assign sequential signup numbers, optionally filtered by event_type."""
    result = []
    for i, p in enumerate(players, start=1):
        out = PlayerOut.model_validate(p)
        out.signup_number = i
        result.append(out)
    return result


@router.get("/specs", response_model=ClassSpecResponse)
async def get_class_specs():
    return ClassSpecResponse(classes=VALID_SPECS)


@router.get("/roster", response_model=RosterResponse)
async def get_roster(event_type: str = Query(default=None), db: AsyncSession = Depends(get_db)):
    query = select(Player).order_by(Player.signed_up_at)
    if event_type:
        query = query.where(Player.event_type == event_type)
    result = await db.execute(query)
    players = result.scalars().all()
    state = await _get_event_state(db)
    return RosterResponse(
        players=_assign_signup_numbers(players),
        is_locked=state.is_locked if state else False,
    )


@router.post("/signup", response_model=SignupResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Only check lock for mythicplus signups
    if req.event_type == "mythicplus":
        state = await _get_event_state(db)
        if state and state.is_locked:
            raise HTTPException(status_code=403, detail="M+ signups are locked")

    specs = get_specs_for_class(req.wow_class)
    if req.specialization not in specs:
        raise HTTPException(status_code=400, detail=f"{req.specialization} is not a valid spec for {req.wow_class}")

    role = specs[req.specialization]

    # Check for duplicate within same event type
    existing = await db.execute(
        select(Player)
        .where(Player.username.ilike(req.username))
        .where(Player.event_type == req.event_type)
    )
    if existing.scalar_one_or_none():
        event_label = "M+" if req.event_type == "mythicplus" else "Raid"
        raise HTTPException(status_code=409, detail=f"Already signed up for {event_label}")

    player = Player(
        username=req.username, wow_class=req.wow_class,
        specialization=req.specialization, role=role,
        event_type=req.event_type, signup_status=req.signup_status,
        can_provide_lust=req.can_provide_lust if req.wow_class == "Hunter" else False,
        can_interrupt=req.can_interrupt if req.wow_class == "Warlock" else False,
        utility_overrides="{}",
    )
    db.add(player)
    await db.commit()
    await db.refresh(player)

    # Get signup number for this event type
    all_players = await db.execute(
        select(Player)
        .where(Player.event_type == req.event_type)
        .order_by(Player.signed_up_at)
    )
    all_list = all_players.scalars().all()
    signup_num = next((i for i, p in enumerate(all_list, 1) if p.id == player.id), 0)

    out = PlayerOut.model_validate(player)
    out.signup_number = signup_num

    status_label = ""
    if req.signup_status == "tentative":
        status_label = " [TENT]"
    elif req.signup_status == "late":
        status_label = " [LATE]"

    event_label = "M+" if req.event_type == "mythicplus" else "Raid"

    return SignupResponse(
        success=True,
        message=f"#{signup_num} — {req.username} signed up for {event_label} as {req.wow_class} {req.specialization} ({role}){status_label}",
        player=out,
    )


@router.delete("/signup/{username}", response_model=SignupResponse)
async def cancel_signup(username: str, event_type: str = Query(default="mythicplus"), db: AsyncSession = Depends(get_db)):
    if event_type == "mythicplus":
        state = await _get_event_state(db)
        if state and state.is_locked:
            raise HTTPException(status_code=403, detail="M+ signups are locked")

    result = await db.execute(
        select(Player)
        .where(Player.username.ilike(username))
        .where(Player.event_type == event_type)
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    await db.delete(player)
    await db.commit()
    return SignupResponse(success=True, message=f"{username} removed from signup")


async def _get_event_state(db: AsyncSession) -> EventState | None:
    result = await db.execute(select(EventState).where(EventState.id == 1))
    return result.scalar_one_or_none()
