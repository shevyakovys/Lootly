from __future__ import annotations

import asyncio
import uuid

import structlog

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.services.scheduler import SchedulerService
from app.workers.tasks import check_monitor

logger = structlog.get_logger(__name__)


async def enqueue_monitor(monitor_id: uuid.UUID) -> None:
    await asyncio.to_thread(check_monitor.send, str(monitor_id))


async def scheduler_tick() -> int:
    settings = get_settings()
    async with get_session_factory()() as session:
        due = await SchedulerService(session).claim_due(settings.scheduler_batch_size)

    enqueued = 0
    for monitor_id in due:
        try:
            await enqueue_monitor(monitor_id)
            enqueued += 1
        except Exception:
            logger.exception("monitor_enqueue_failed", monitor_id=str(monitor_id))
            async with get_session_factory()() as recovery_session:
                await SchedulerService(recovery_session).release_for_retry(monitor_id)

    return enqueued


async def run_scheduler() -> None:
    settings = get_settings()
    logger.info(
        "scheduler_started",
        poll_seconds=settings.scheduler_poll_seconds,
        batch_size=settings.scheduler_batch_size,
    )
    while True:
        await scheduler_tick()
        await asyncio.sleep(settings.scheduler_poll_seconds)


if __name__ == "__main__":
    asyncio.run(run_scheduler())
