from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.database import get_db
from app.models.models import Player, EventState, ArchivedPlayer
from app.models.schemas import AdminRequest, SaveGroupsRequest, has_lust, has_brez
from app.services.sorting import auto_sort
from app.routers.admin import _verify_password

router = APIRouter()

CLASS_EMOJI = {
    "Warrior": ":crossed_swords:", "Paladin": ":shield:", "Hunter": ":bow_and_arrow:",
    "Rogue": ":dagger:", "Priest": ":star:", "Death Knight": ":skull:",
    "Shaman": ":zap:", "Mage": ":snowflake:", "Warlock": ":purple_circle:",
    "Monk": ":leaves:", "Druid": ":deciduous_tree:", "Demon Hunter": ":smiling_imp:",
    "Evoker": ":dragon:",
}
ROLE_EMOJI = {"Tank": ":shield:", "Healer": ":green_heart:", "Melee": ":crossed_swords:", "Ranged": ":dart:"}


async def _get_last_benched(db: AsyncSession) -> set[str]:
    latest = await db.execute(
        select(ArchivedPlayer.event_date)
        .where(ArchivedPlayer.event_type == "mythicplus")
        .order_by(desc(ArchivedPlayer.event_date))
        .limit(1)
    )
    latest_date = latest.scalar_one_or_none()
    if not latest_date:
        return set()
    result = await db.execute(
        select(ArchivedPlayer.username)
        .where(ArchivedPlayer.event_date == latest_date)
        .where(ArchivedPlayer.group_index == "Bench")
        .where(ArchivedPlayer.event_type == "mythicplus")
    )
    return {row[0] for row in result.all()}


@router.post("/sort")
async def sort_groups(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)

    # Only sort M+ players
    result = await db.execute(
        select(Player)
        .where(Player.event_type == "mythicplus")
        .order_by(Player.signed_up_at)
    )
    players = result.scalars().all()

    available_count = sum(1 for p in players if p.signup_status == "available")
    if available_count < 5:
        raise HTTPException(status_code=400, detail="Need at least 5 available M+ players to form a group")

    bench_priority_names = await _get_last_benched(db)

    player_dicts = [
        {
            "id": p.id, "username": p.username, "wow_class": p.wow_class,
            "specialization": p.specialization, "role": p.role,
            "signup_status": p.signup_status,
            "signed_up_at": p.signed_up_at.isoformat() if p.signed_up_at else "",
        }
        for p in players
    ]

    sorted_result = auto_sort(player_dicts, bench_priority_names)

    group_map = {}
    for gi, group in enumerate(sorted_result["groups"]):
        for p in group:
            group_map[p["username"]] = str(gi)
    for p in sorted_result["bench"]:
        group_map[p["username"]] = "Bench"

    for p in players:
        p.group_index = group_map.get(p.username, "Bench")
    await db.commit()

    groups_out = []
    for gi, group in enumerate(sorted_result["groups"]):
        g_lust = any(has_lust(p["wow_class"]) for p in group)
        g_brez = any(has_brez(p["wow_class"]) for p in group)
        groups_out.append({"index": gi, "players": group, "has_lust": g_lust, "has_brez": g_brez})

    return {
        "success": True,
        "groups": groups_out,
        "bench": sorted_result["bench"],
        "bench_priority_names": list(bench_priority_names),
        "message": f"Sorted {len(players)} M+ players into {len(sorted_result['groups'])} groups, {len(sorted_result['bench'])} benched",
    }


@router.post("/discord-export")
async def discord_export(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(select(Player).order_by(Player.signed_up_at))
    players = result.scalars().all()

    mp_players = [p for p in players if p.event_type == "mythicplus"]
    raid_players = [p for p in players if p.event_type == "raid"]

    lines = ["# :owl: NightOwls Weekly Groups :owl:", ""]

    # M+ section
    if mp_players:
        groups, bench = {}, []
        for p in mp_players:
            if p.group_index and p.group_index not in ("", "Bench"):
                gi = int(p.group_index)
                if gi not in groups: groups[gi] = []
                groups[gi].append(p)
            else:
                bench.append(p)

        lines.append("## :key: Mythic+ (Friday 11:30 PM EST)")
        lines.append("")

        if groups:
            for gi in sorted(groups.keys()):
                members = groups[gi]
                g_lust = any(has_lust(p.wow_class) for p in members)
                g_brez = any(has_brez(p.wow_class) for p in members)
                badges = []
                badges.append(":zap: Lust" if g_lust else ":x: No Lust")
                badges.append(":green_circle: B-Rez" if g_brez else ":x: No B-Rez")
                lines.append(f"### Group {gi + 1}  {' | '.join(badges)}")
                role_order = {"Tank": 1, "Healer": 2, "Melee": 3, "Ranged": 4}
                for p in sorted(members, key=lambda p: role_order.get(p.role, 5)):
                    emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
                    status = ""
                    if p.signup_status == "tentative": status = " `[TENT]`"
                    elif p.signup_status == "late": status = " `[LATE]`"
                    lines.append(f"{ROLE_EMOJI.get(p.role, '')} {emoji} **{p.username}** — {p.wow_class} ({p.specialization}){status}")
                lines.append("")

        if bench:
            lines.append("### :chair: Bench")
            for p in bench:
                emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
                status = ""
                if p.signup_status == "tentative": status = " `[TENT]`"
                elif p.signup_status == "late": status = " `[LATE]`"
                lines.append(f"{emoji} {p.username} — {p.wow_class} ({p.specialization}){status}")
            lines.append("")

    # Raid section
    if raid_players:
        lines.append("## :crossed_swords: Raid (Saturday 11:30 PM EST)")
        lines.append("")
        tanks = [p for p in raid_players if p.role == "Tank"]
        healers = [p for p in raid_players if p.role == "Healer"]
        dps = [p for p in raid_players if p.role in ("Melee", "Ranged")]

        if tanks:
            main_tanks = tanks[:2]
            backup_tanks = tanks[2:]
            lines.append("**Tanks:**")
            for p in main_tanks:
                emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
                status = ""
                if p.signup_status == "tentative": status = " `[TENT]`"
                elif p.signup_status == "late": status = " `[LATE]`"
                lines.append(f":shield: {emoji} **{p.username}** — {p.wow_class} ({p.specialization}){status}")
            if backup_tanks:
                lines.append("*Backup Tanks:*")
                for p in backup_tanks:
                    emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
                    lines.append(f":shield: {emoji} {p.username} — {p.wow_class} ({p.specialization}) `[BACKUP]`")
            lines.append("")

        if healers:
            lines.append("**Healers:**")
            for p in healers:
                emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
                status = ""
                if p.signup_status == "tentative": status = " `[TENT]`"
                elif p.signup_status == "late": status = " `[LATE]`"
                lines.append(f":green_heart: {emoji} **{p.username}** — {p.wow_class} ({p.specialization}){status}")
            lines.append("")

        if dps:
            lines.append("**DPS:**")
            for p in dps:
                emoji = CLASS_EMOJI.get(p.wow_class, ":question:")
                role_e = ROLE_EMOJI.get(p.role, "")
                status = ""
                if p.signup_status == "tentative": status = " `[TENT]`"
                elif p.signup_status == "late": status = " `[LATE]`"
                lines.append(f"{role_e} {emoji} **{p.username}** — {p.wow_class} ({p.specialization}){status}")
            lines.append("")

    total = len(players)
    lines.append(f"*{total} total signups*")

    return {"success": True, "discord_text": "\n".join(lines)}


@router.get("/bench-priority")
async def get_bench_priority(db: AsyncSession = Depends(get_db)):
    names = await _get_last_benched(db)
    return {"bench_priority": list(names)}


@router.post("/save")
async def save_groups(req: SaveGroupsRequest, db: AsyncSession = Depends(get_db)):
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
