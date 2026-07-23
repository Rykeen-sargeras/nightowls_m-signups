from fastapi import APIRouter, Depends, HTTPException
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.database import get_db
from app.models.models import EventState, Player
from app.models.schemas import (
    AdminRequest, SaveGroupsRequest, SortingSettingsRequest, PlayerUtilityRequest,
    has_lust, has_brez,
)
from app.services.sorting import auto_sort, validate_hard_constraints
from app.services.utility import score_group
from app.services.sorting_state import (
    get_last_benched, get_sorting_settings as get_sorting_settings_row,
    load_blocked_pairs, player_to_sort_dict,
)
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


def _player_has_lust(player) -> bool:
    return has_lust(player.wow_class, getattr(player, "can_provide_lust", False))


@router.post("/sorting-settings/get")
async def read_sorting_settings(req: AdminRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    settings = await get_sorting_settings_row(db)
    return {"blocked_pairs": load_blocked_pairs(settings)}


@router.post("/sorting-settings")
async def save_sorting_settings(req: SortingSettingsRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    clean: list[list[str]] = []
    seen: set[frozenset[str]] = set()
    for pair in req.blocked_pairs:
        if len(pair) != 2:
            continue
        first, second = pair[0].strip(), pair[1].strip()
        key = frozenset((first.casefold(), second.casefold()))
        if first and second and first.casefold() != second.casefold() and key not in seen:
            seen.add(key)
            clean.append([first, second])
    settings = await get_sorting_settings_row(db)
    settings.blocked_pairs = json.dumps(clean)
    await db.commit()
    return {"success": True, "blocked_pairs": clean, "message": f"Saved {len(clean)} blocked pair(s)"}


@router.post("/player-utility/{username}")
async def update_player_utility(username: str, req: PlayerUtilityRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(
        select(Player)
        .where(Player.username.ilike(username))
        .where(Player.event_type == "mythicplus")
    )
    player = result.scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="M+ player not found")
    if req.can_provide_lust is not None:
        player.can_provide_lust = bool(req.can_provide_lust)
    if req.can_interrupt is not None:
        player.can_interrupt = bool(req.can_interrupt)
    player.utility_overrides = json.dumps(req.utility_overrides or {})
    await db.commit()
    return {"success": True, "message": f"Updated sorting utility for {player.username}"}


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

    bench_priority_names = await get_last_benched(db)
    settings = await get_sorting_settings_row(db)
    blocked_pairs = load_blocked_pairs(settings)
    player_dicts = [player_to_sort_dict(player) for player in players]

    sorted_result = auto_sort(player_dicts, bench_priority_names, blocked_pairs)
    if not sorted_result["hard_constraints_validated"]:
        raise HTTPException(status_code=500, detail="Sorter safety validation failed; no groups were saved")

    group_map: dict[str, str] = {}
    role_map: dict[str, str] = {}
    for gi, group in enumerate(sorted_result["groups"]):
        for member in group:
            key = member["username"].casefold()
            group_map[key] = str(gi)
            role_map[key] = member["role"]
    for member in sorted_result["bench"]:
        key = member["username"].casefold()
        group_map[key] = "Bench"
        if member.get("role"):
            role_map[key] = member["role"]

    for player in players:
        key = player.username.casefold()
        player.group_index = group_map.get(key, "Bench")
        if key in role_map:
            player.role = role_map[key]

    state_result = await db.execute(select(EventState).where(EventState.id == 1))
    state = state_result.scalar_one_or_none()
    if state is None:
        state = EventState(id=1, is_locked=True, locked_at=func.now())
        db.add(state)
    else:
        state.is_locked = True
        state.locked_at = func.now()
    await db.commit()

    groups_out = []
    for gi, group in enumerate(sorted_result["groups"]):
        metrics = sorted_result["group_metrics"][gi]
        groups_out.append({
            "index": gi,
            "members": group,
            "players": group,
            "has_lust": metrics["has_lust"],
            "has_brez": metrics["has_brez"],
            "reliable_interrupts": metrics["reliable_interrupts"],
            "melee_dps": metrics["melee_dps"],
            "ranged_dps": metrics["ranged_dps"],
            "utility_score": metrics["score"],
        })

    priority_note = ""
    if sorted_result["priority_deferred"]:
        priority_note = f" Priority deferred by role capacity/blocks: {', '.join(sorted_result['priority_deferred'])}."

    return {
        "success": True,
        "groups": groups_out,
        "bench": sorted_result["bench"],
        "bench_priority_names": list(bench_priority_names),
        "priority_grouped": sorted_result["priority_grouped"],
        "priority_deferred": sorted_result["priority_deferred"],
        "blocked_pairs": blocked_pairs,
        "hard_constraints_validated": True,
        "message": (
            f"Sorted {len(players)} M+ players into {len(sorted_result['groups'])} legal groups, "
            f"{len(sorted_result['bench'])} benched.{priority_note}"
        ),
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
                _, metrics = score_group([player_to_sort_dict(player) for player in members])
                g_lust = metrics["has_lust"]
                g_brez = metrics["has_brez"]
                badges = []
                badges.append(":zap: Lust" if g_lust else ":x: No Lust")
                badges.append(":green_circle: B-Rez" if g_brez else ":x: No B-Rez")
                badges.append(f":speech_balloon: {metrics['reliable_interrupts']} Kicks")
                badges.append(f"{metrics['melee_dps']}M/{metrics['ranged_dps']}R")
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
    names = await get_last_benched(db)
    return {"bench_priority": list(names)}


@router.post("/save")
async def save_groups(req: SaveGroupsRequest, db: AsyncSession = Depends(get_db)):
    _verify_password(req.password)
    result = await db.execute(
        select(Player)
        .where(Player.event_type == "mythicplus")
        .order_by(Player.signed_up_at)
    )
    players = result.scalars().all()
    player_map = {player.username.casefold(): player for player in players}

    proposed: dict[str, list[dict]] = {}
    assignments: dict[str, str] = {}
    for username, group_index in req.groups.items():
        player = player_map.get(username.casefold())
        if not player:
            continue
        normalized_index = str(group_index)
        assignments[player.username.casefold()] = normalized_index
        if normalized_index not in {"", "Bench"}:
            proposed.setdefault(normalized_index, []).append(player_to_sort_dict(player))

    settings = await get_sorting_settings_row(db)
    blocked_pairs = load_blocked_pairs(settings)
    proposed_groups = [proposed[key] for key in sorted(proposed, key=lambda value: (0, int(value)) if value.isdigit() else (1, value))]
    if not validate_hard_constraints(proposed_groups, blocked_pairs):
        raise HTTPException(
            status_code=400,
            detail=(
                "Groups were not saved. Every group must have exactly 1 Tank, 1 Healer, "
                "3 DPS, no duplicate player, no blocked pair, and no role swaps."
            ),
        )

    updated = 0
    for player in players:
        player.group_index = assignments.get(player.username.casefold(), "Bench")
        updated += 1
    await db.commit()
    return {"success": True, "message": f"Saved and validated group assignments for {updated} players"}

