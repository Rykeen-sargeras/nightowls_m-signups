from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.models import Player, EventState
from app.models.schemas import AdminRequest, SaveGroupsRequest, has_lust, has_brez
from app.services.sorting import auto_sort
from app.routers.admin import _verify_password

router = APIRouter()


@router.post("/sort")
async def sort_groups(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    """Auto-sort all signed-up players into 5-man groups."""
    _verify_password(req.password)

    # Fetch all players ordered by signed_up_at (earliest first)
    result = await db.execute(select(Player).order_by(Player.signed_up_at))
    players = result.scalars().all()

    if len(players) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 players to form a group")

    # Convert to dicts with signed_up_at for the sorter
    player_dicts = [
        {
            "id": p.id,
            "username": p.username,
            "wow_class": p.wow_class,
            "specialization": p.specialization,
            "role": p.role,
            "signed_up_at": p.signed_up_at.isoformat() if p.signed_up_at else "",
        }
        for p in players
    ]

    # Run the sort — players are already in signup order
    sorted_result = auto_sort(player_dicts)

    # Assign group indices back to the database
    group_map = {}  # username -> group_index string
    for gi, group in enumerate(sorted_result["groups"]):
        for p in group:
            group_map[p["username"]] = str(gi)
    for p in sorted_result["bench"]:
        group_map[p["username"]] = "Bench"

    # Update all players
    for p in players:
        p.group_index = group_map.get(p.username, "Bench")
    await db.commit()

    # Build response with utility badges per group
    groups_out = []
    for gi, group in enumerate(sorted_result["groups"]):
        g_lust = any(has_lust(p["wow_class"]) for p in group)
        g_brez = any(has_brez(p["wow_class"]) for p in group)
        groups_out.append({
            "index": gi,
            "players": group,
            "has_lust": g_lust,
            "has_brez": g_brez,
        })

    return {
        "success": True,
        "groups": groups_out,
        "bench": sorted_result["bench"],
        "message": f"Sorted {len(players)} players into {len(sorted_result['groups'])} groups, {len(sorted_result['bench'])} benched",
    }


@router.post("/save")
async def save_groups(req: SaveGroupsRequest, db: AsyncSession = Depends(get_db)):
    """Save manual group assignments (from drag & drop)."""
    _verify_password(req.password)

    result = await db.execute(select(Player))
    players = result.scalars().all()
    player_map = {p.username: p for p in players}

    updated = 0
    for username, group_index in req.groups.items():
        if username in player_map:
            player_map[username].group_index = group_index
            updated += 1

    await db.commit()
    return {"success": True, "message": f"Saved group assignments for {updated} players"}
