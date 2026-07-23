"""NightOwls scheduled Mythic+ operations.

- Friday 8:00 PM Eastern: lock signups and run the same constraint-safe sorter
  used by the admin button.
- Saturday 2:00 AM Eastern: archive the complete roster in one shared batch and
  reset signups. The most recent available M+ bench becomes next week's
  placement-priority list.
"""
from __future__ import annotations

import logging
import uuid

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from sqlalchemy import delete, func, select

from app.database import async_session
from app.models.models import ArchivedPlayer, EventState, Player
from app.services.sorting import auto_sort
from app.services.sorting_state import (
    get_last_benched,
    get_sorting_settings,
    load_blocked_pairs,
    player_to_sort_dict,
)

logger = logging.getLogger("nightowls.scheduler")
EST = pytz.timezone("US/Eastern")
scheduler = AsyncIOScheduler(timezone=EST)


async def _get_or_create_event_state(db) -> EventState:
    result = await db.execute(select(EventState).where(EventState.id == 1))
    state = result.scalar_one_or_none()
    if state is None:
        state = EventState(id=1, is_locked=False)
        db.add(state)
        await db.flush()
    return state


async def auto_lock_and_sort():
    """Friday 8 PM Eastern — lock and sort using all current constraints."""
    logger.info("AUTO-LOCK: Starting Friday lock & sort...")
    async with async_session() as db:
        try:
            state = await _get_or_create_event_state(db)
            if state.is_locked:
                logger.info("AUTO-LOCK: Already locked, skipping")
                return

            result = await db.execute(
                select(Player)
                .where(Player.event_type == "mythicplus")
                .order_by(Player.signed_up_at)
            )
            players = result.scalars().all()

            priority_names = await get_last_benched(db)
            settings = await get_sorting_settings(db)
            blocked_pairs = load_blocked_pairs(settings)
            sorted_data = auto_sort(
                [player_to_sort_dict(player) for player in players],
                priority_names,
                blocked_pairs,
            )
            if not sorted_data["hard_constraints_validated"]:
                raise RuntimeError("hard-constraint validation failed; roster was not locked")

            assignments: dict[str, str] = {}
            canonical_roles: dict[str, str] = {}
            for group_index, group in enumerate(sorted_data["groups"]):
                for member in group:
                    key = member["username"].casefold()
                    assignments[key] = str(group_index)
                    canonical_roles[key] = member["role"]
            for member in sorted_data["bench"]:
                key = member["username"].casefold()
                assignments[key] = "Bench"
                if member.get("role"):
                    canonical_roles[key] = member["role"]

            for player in players:
                key = player.username.casefold()
                player.group_index = assignments.get(key, "Bench")
                if key in canonical_roles:
                    player.role = canonical_roles[key]

            state.is_locked = True
            state.locked_at = func.now()
            await db.commit()
            logger.info(
                "AUTO-LOCK: Locked & sorted %s M+ players into %s legal groups; %s benched",
                len(players),
                len(sorted_data["groups"]),
                len(sorted_data["bench"]),
            )
        except Exception:
            logger.exception("AUTO-LOCK ERROR")
            await db.rollback()


async def auto_archive_and_reset():
    """Saturday 2 AM Eastern — archive one complete batch and reset."""
    logger.info("AUTO-ARCHIVE: Starting Saturday archive & reset...")
    async with async_session() as db:
        try:
            result = await db.execute(select(Player))
            players = result.scalars().all()
            archive_batch = uuid.uuid4().hex

            for player in players:
                db.add(
                    ArchivedPlayer(
                        username=player.username,
                        wow_class=player.wow_class,
                        specialization=player.specialization,
                        role=player.role,
                        group_index=player.group_index or "Bench",
                        event_type=player.event_type,
                        signup_status=player.signup_status,
                        can_provide_lust=bool(player.can_provide_lust),
                        can_interrupt=bool(player.can_interrupt),
                        utility_overrides=player.utility_overrides or "{}",
                        archive_batch=archive_batch,
                    )
                )

            await db.execute(delete(Player))
            state = await _get_or_create_event_state(db)
            state.is_locked = False
            state.locked_at = None
            await db.commit()
            logger.info(
                "AUTO-ARCHIVE: Archived %s players in batch %s and reset roster",
                len(players),
                archive_batch,
            )
        except Exception:
            logger.exception("AUTO-ARCHIVE ERROR")
            await db.rollback()


def start_scheduler():
    scheduler.add_job(
        auto_lock_and_sort,
        CronTrigger(day_of_week="fri", hour=20, minute=0, timezone=EST),
        id="auto_lock",
        name="Auto-lock signups (Friday 8PM Eastern)",
        replace_existing=True,
    )
    scheduler.add_job(
        auto_archive_and_reset,
        CronTrigger(day_of_week="sat", hour=2, minute=0, timezone=EST),
        id="auto_archive",
        name="Auto-archive & reset (Saturday 2AM Eastern)",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started: Lock=Fri 8PM Eastern, Archive=Sat 2AM Eastern")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
