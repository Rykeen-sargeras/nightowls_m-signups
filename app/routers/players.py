from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Player, EventState
from app.models.schemas import (
    SignupRequest, SignupResponse, PlayerOut, RosterResponse,
    ClassSpecResponse, VALID_SPECS, get_specs_for_class
)

router = APIRouter()


def _assign_signup_numbers(players) -> list[PlayerOut]:
    """
    Takes a list of Player ORM objects (already sorted by signed_up_at)
    and returns PlayerOut models with signup_number assigned sequentially.
    """
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
async def get_roster(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Player).order_by(Player.signed_up_at))
    players = result.scalars().all()
    state = await _get_event_state(db)
    return RosterResponse(
        players=_assign_signup_numbers(players),
        is_locked=state.is_locked if state else False,
    )


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

    # Get the signup number for this new player
    all_players = await db.execute(select(Player).order_by(Player.signed_up_at))
    all_list = all_players.scalars().all()
    signup_num = next((i for i, p in enumerate(all_list, 1) if p.id == player.id), 0)

    out = PlayerOut.model_validate(player)
    out.signup_number = signup_num

    return SignupResponse(
        success=True,
        message=f"#{signup_num} — {req.username} signed up as {req.wow_class} {req.specialization} ({role})",
        player=out,
    )


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
    return SignupResponse(success=True, message=f"{username} removed from signup")


async def _get_event_state(db: AsyncSession) -> EventState | None:
    result = await db.execute(select(EventState).where(EventState.id == 1))
    return result.scalar_one_or_none()
