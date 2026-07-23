"""Database helpers shared by manual and scheduled Mythic+ sorting."""
from __future__ import annotations

from datetime import timedelta
import json

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import ArchivedPlayer, Player, SortingSettings


async def get_last_benched(db: AsyncSession) -> set[str]:
    """Players benched while available in the most recent M+ archive batch.

    A player who remains benched will appear in the next archive again, so the
    priority naturally carries forward until they are placed in a group.
    """
    latest = await db.execute(
        select(ArchivedPlayer.archive_batch, ArchivedPlayer.event_date)
        .where(ArchivedPlayer.event_type == "mythicplus")
        .order_by(desc(ArchivedPlayer.event_date))
        .limit(1)
    )
    row = latest.first()
    if not row:
        return set()

    archive_batch, latest_date = row
    query = (
        select(ArchivedPlayer.username)
        .where(ArchivedPlayer.group_index == "Bench")
        .where(ArchivedPlayer.event_type == "mythicplus")
        .where(ArchivedPlayer.signup_status == "available")
    )
    if archive_batch:
        query = query.where(ArchivedPlayer.archive_batch == archive_batch)
    else:
        # Compatibility for archives created before shared batch IDs existed.
        query = query.where(ArchivedPlayer.event_date >= latest_date - timedelta(seconds=10))
        query = query.where(ArchivedPlayer.event_date <= latest_date)

    result = await db.execute(query)
    return {name for (name,) in result.all()}


async def get_sorting_settings(db: AsyncSession) -> SortingSettings:
    result = await db.execute(select(SortingSettings).where(SortingSettings.id == 1))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = SortingSettings(id=1, blocked_pairs="[]")
        db.add(settings)
        await db.flush()
    return settings


def load_blocked_pairs(settings: SortingSettings) -> list[list[str]]:
    try:
        pairs = json.loads(settings.blocked_pairs or "[]")
    except (json.JSONDecodeError, TypeError):
        return []

    clean: list[list[str]] = []
    seen: set[frozenset[str]] = set()
    for pair in pairs if isinstance(pairs, list) else []:
        if not isinstance(pair, (list, tuple)) or len(pair) != 2:
            continue
        first, second = str(pair[0]).strip(), str(pair[1]).strip()
        key = frozenset((first.casefold(), second.casefold()))
        if first and second and first.casefold() != second.casefold() and key not in seen:
            seen.add(key)
            clean.append([first, second])
    return clean


def player_to_sort_dict(player: Player) -> dict:
    try:
        overrides = json.loads(player.utility_overrides or "{}")
    except (json.JSONDecodeError, TypeError):
        overrides = {}
    return {
        "id": player.id,
        "username": player.username,
        "wow_class": player.wow_class,
        "specialization": player.specialization,
        "role": player.role,
        "signup_status": player.signup_status,
        "signed_up_at": player.signed_up_at.isoformat() if player.signed_up_at else "",
        "can_provide_lust": bool(player.can_provide_lust),
        "can_interrupt": bool(player.can_interrupt),
        "utility_overrides": overrides if isinstance(overrides, dict) else {},
    }
