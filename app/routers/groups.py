from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Player
from app.models.schemas import AdminRequest, SaveGroupsRequest
from app.services.sorting import auto_sort
from app.routers.admin import _verify_password

router = APIRouter()


@router.post("/sort")
async def sort_groups(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(Player))
    players = result.scalars().all()
    player_dicts = [
        {"username": p.username, "wow_class": p.wow_class, "specialization": p.specialization, "role": p.role}
        for p in players
    ]
    sorted_data = auto_sort(player_dicts)
    groups_out = []
    for i, group in enumerate(sorted_data["groups"]):
        groups_out.append({"index": i, "name": f"NightOwls Squad {i + 1}", "members": group})
    return {"success": True, "groups": groups_out, "bench": sorted_data["bench"]}


@router.post("/save")
async def save_groups(req: SaveGroupsRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(Player))
    players = {p.username.lower(): p for p in result.scalars().all()}
    updated = 0
    for username, group_index in req.groups.items():
        player = players.get(username.lower())
        if player:
            player.group_index = str(group_index)
            updated += 1
    await db.commit()
    return {"success": True, "message": f"Saved {updated} player assignments"}
