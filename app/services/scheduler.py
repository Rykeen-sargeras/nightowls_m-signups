"""
NightOwls Auto-Scheduler
- Friday 8:00 PM EST: Auto-lock signups and sort groups
- Saturday 2:00 AM EST: Auto-archive and reset for next week
"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz
from sqlalchemy import select, delete, func
from app.database import async_session
from app.models.models import Player, EventState, ArchivedPlayer
from app.services.sorting import auto_sort

logger = logging.getLogger("nightowls.scheduler")
EST = pytz.timezone("US/Eastern")

scheduler = AsyncIOScheduler(timezone=EST)


async def auto_lock_and_sort():
    """Friday 8PM EST — Lock signups and auto-sort into groups."""
    logger.info("AUTO-LOCK: Starting Friday lock & sort...")
    async with async_session() as db:
        try:
            # Get or create event state
            result = await db.execute(select(EventState).where(EventState.id == 1))
            state = result.scalar_one_or_none()
            if not state:
                state = EventState(id=1, is_locked=False)
                db.add(state)
                await db.flush()

            if state.is_locked:
                logger.info("AUTO-LOCK: Already locked, skipping")
                return

            # Lock
            state.is_locked = True
            state.locked_at = func.now()

            # Get players and sort
            result = await db.execute(select(Player))
            players = result.scalars().all()

            if not players:
                logger.info("AUTO-LOCK: No players signed up, locking empty")
                await db.commit()
                return

            player_dicts = [
                {"username": p.username, "wow_class": p.wow_class, "specialization": p.specialization, "role": p.role}
                for p in players
            ]
            sorted_data = auto_sort(player_dicts)

            # Save group assignments
            player_map = {p.username.lower(): p for p in players}
            for i, group in enumerate(sorted_data["groups"]):
                for member in group:
                    player = player_map.get(member["username"].lower())
                    if player:
                        player.group_index = str(i)

            for bench_member in sorted_data["bench"]:
                player = player_map.get(bench_member["username"].lower())
                if player:
                    player.group_index = "Bench"

            await db.commit()
            logger.info(f"AUTO-LOCK: Locked & sorted {len(players)} players into {len(sorted_data['groups'])} groups")
        except Exception as e:
            logger.error(f"AUTO-LOCK ERROR: {e}")
            await db.rollback()


async def auto_archive_and_reset():
    """Saturday 2AM EST — Archive current event and reset for next week."""
    logger.info("AUTO-ARCHIVE: Starting Saturday archive & reset...")
    async with async_session() as db:
        try:
            # Copy players to archive
            result = await db.execute(select(Player))
            players = result.scalars().all()

            for p in players:
                db.add(ArchivedPlayer(
                    username=p.username, wow_class=p.wow_class,
                    specialization=p.specialization, role=p.role, group_index=p.group_index,
                ))

            # Delete all players
            await db.execute(delete(Player))

            # Reset lock state
            result = await db.execute(select(EventState).where(EventState.id == 1))
            state = result.scalar_one_or_none()
            if state:
                state.is_locked = False
                state.locked_at = None

            await db.commit()
            logger.info(f"AUTO-ARCHIVE: Archived {len(players)} players, roster reset")
        except Exception as e:
            logger.error(f"AUTO-ARCHIVE ERROR: {e}")
            await db.rollback()


def start_scheduler():
    """Start the background scheduler with cron jobs."""
    # Friday 8:00 PM EST — auto lock & sort
    scheduler.add_job(
        auto_lock_and_sort,
        CronTrigger(day_of_week="fri", hour=20, minute=0, timezone=EST),
        id="auto_lock",
        name="Auto-lock signups (Friday 8PM EST)",
        replace_existing=True,
    )

    # Saturday 2:00 AM EST — auto archive & reset
    scheduler.add_job(
        auto_archive_and_reset,
        CronTrigger(day_of_week="sat", hour=2, minute=0, timezone=EST),
        id="auto_archive",
        name="Auto-archive & reset (Saturday 2AM EST)",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Scheduler started: Lock=Fri 8PM EST, Archive=Sat 2AM EST")


def stop_scheduler():
    """Shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler stopped")
