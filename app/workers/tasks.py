from __future__ import annotations

import uuid

import dramatiq
from redis.asyncio import Redis
from redis.exceptions import LockNotOwnedError

from app.adapters.factory import build_adapter_registry
from app.adapters.registry import AdapterNotFound
from app.core.config import get_settings
from app.db.session import get_session_factory
from app.queue import broker
from app.services.monitoring import MonitoringService
from app.services.search_monitors import SearchMonitorNotFound


@dramatiq.actor(
    broker=broker,
    queue_name="monitoring",
    max_retries=5,
    min_backoff=5_000,
    max_backoff=60_000,
    time_limit=120_000,
    throws=(AdapterNotFound, SearchMonitorNotFound),
)
async def check_monitor(monitor_id: str) -> None:
    parsed_id = uuid.UUID(monitor_id)
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url)
    lock = redis.lock(
        f"lootly:monitor-lock:{parsed_id}",
        timeout=settings.monitor_lock_seconds,
        blocking_timeout=0,
    )
    acquired = await lock.acquire(blocking=False)
    if not acquired:
        await redis.aclose()
        return

    try:
        async with get_session_factory()() as session:
            await MonitoringService(
                session=session,
                registry=build_adapter_registry(),
            ).run(parsed_id)
    finally:
        try:
            if await lock.owned():
                await lock.release()
        except LockNotOwnedError:
            pass
        await redis.aclose()
