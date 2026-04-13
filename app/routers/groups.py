from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.database import get_db
from app.models.models import Player, EventState, ArchivedPlayer
from app.models.schemas import AdminRequest, SaveGroupsRequest, has_lust, has_brez
from app.services.sorting import auto_sort
from app.routers.admin import _verify_password

router = APIRouter()

# Discord class emoji mapping
CLASS_EMOJI = {
    "Warrior": ":crossed_swords:",
    "Paladin": ":shield:",
    "Hunter": ":bow_and_arrow:",
    "Rogue": ":dagger:",
    "Priest": ":star:",
    "Death Knight": ":skull:",
    "Shaman": ":zap:",
    "Mage": ":snowflake:",
    "Warlock": ":purple_circle:",
    "Monk": ":leaves:",
    "Druid": ":deciduous_tree:",
    "Demon Hunter": ":smiling_imp:",
    "Evoker": ":dragon:",
}

ROLE_EMOJI = {
    "Tank": ":shield:",
    "Healer": ":green_heart:",
    "Melee": ":crossed_swords:",
    "Ranged": ":dart:",
}


async def _get_last_benched(db: AsyncSession) -> set[str]:
    """
    Find players who were benched in the most recent archived event.
    Returns a set of usernames (case-preserved).
    """
    # Get the most recent archive date
    latest = await db.execute(
        select(ArchivedPlayer.event_date)
        .order_by(desc(ArchivedPlayer.event_date))
        .limit(1)
    )
    latest_date = latest.scalar_one_or_none()
    if not latest_date:
        return set()

    # Get all archived players from that date who were benched
    result = await db.execute(
        select(ArchivedPlayer.username)
        .where(ArchivedPlayer.event_date == latest_date)
        .where(ArchivedPlayer.group_index == "Bench")
    )
    return {row[0] for row in result.all()}


@router.post("/sort")
async def sort_groups(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    """Auto-sort all signed-up players into 5-man groups."""
    _verify_password(req.password)

    # Fetch all players ordered by signed_up_at (earliest first)
    result = await db.execute(select(Player).order_by(Player.signed_up_at))
    players = result.scalars().all()

    if len(players) < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 players to form a group")

    # Get bench priority names from last week's archive
    bench_priority_names = await _get_last_benched(db)

    # Convert to dicts
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

    # Run the sort with bench priority
    sorted_result = auto_sort(player_dicts, bench_priority_names)

    # Assign group indices back to the database
    group_map = {}
    for gi, group in enumerate(sorted_result["groups"]):
        for p in group:
            group_map[p["username"]] = str(gi)
    for p in sorted_result["bench"]:
        group_map[p["username"]] = "Bench"

    for p in players:
        p.group_index = group_map.get(p.username, "Bench")
    await db.commit()

    # Count how many bench-priority players got placed
    priority_placed = sum(
        1 for g in sorted_result["groups"]
        for p in g if p.get("bench_priority")
    )
    priority_benched = sum(
        1 for p in sorted_result["bench"] if p.get("bench_priority")
    )

    # Build response
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

    msg = f"Sorted {len(players)} players into {len(sorted_result['groups'])} groups, {len(sorted_result['bench'])} benched"
    if priority_placed > 0:
        msg += f" ({priority_placed} bench-priority player{'s' if priority_placed != 1 else ''} guaranteed placement)"

    return {
        "success": True,
        "groups": groups_out,
        "bench": sorted_result["bench"],
        "bench_priority_names": list(bench_priority_names),
        "message": msg,
    }


@router.post("/discord-export")
async def discord_export(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    """Generate a Discord-formatted message with all groups."""
    _verify_password(req.password)

    result = await db.execute(select(Player).order_by(Player.signed_up_at))
    players = result.scalars().all()

    # Build group map
    groups = {}
    bench = []
    for p in players:
        if p.group_index and p.group_index != "" and p.group_index != "Bench":
            gi = int(p.group_index)
            if gi not in groups:
                groups[gi] = []
            groups[gi].append(p)
        else:
            bench.append(p)

    if not groups:
        raise HTTPException(status_code=400, detail="No groups formed yet — lock and sort first")

    lines = ["# :owl: NightOwls Mythic+ Groups :owl:", ""]

    for gi in sorted(groups.keys()):
        members = groups[gi]
        g_lust = any(has_lust(p.wow_class) for p in members)
        g_brez = any(has_brez(p.wow_class) for p in members)

        badges = []
        if g_lust:
            badges.append(":zap: Lust")
        else:
            badges.append(":x: No Lust")
        if g_brez:
            badges.append(":green_circle: B-Rez")
        else:
            badges.append(":x: No B-Rez")

        lines.append(f"## Group {gi + 1}  {' | '.join(badges)}")

        role_order = {"Tank": 1, "Healer": 2, "Melee": 3, "Ranged": 4}
        sorted_members = sorted(members, key=lambda p: role_order.get(p.role, 5))

        for p in sorted_members:
            emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
            role_emoji = ROLE_EMOJI.get(p.role, "")
            lines.append(f"{role_emoji} {emoji} **{p.username}** — {p.wow_class} ({p.specialization})")

        lines.append("")

    if bench:
        lines.append("## :chair: Bench")
        for p in bench:
            emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
            lines.append(f"{emoji} {p.username} — {p.wow_class} ({p.specialization})")
        lines.append("")

    lines.append(f"*{len(players)} players | {len(groups)} groups | {len(bench)} benched*")

    return {"success": True, "discord_text": "\n".join(lines)}


@router.get("/bench-priority")
async def get_bench_priority(db: AsyncSession = Depends(get_db)):
    """Return list of players who have bench priority this week."""
    names = await _get_last_benched(db)
    return {"bench_priority": list(names)}


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
