from __future__ import annotations

import uuid
from datetime import UTC, datetime

import dramatiq
from redis.asyncio import Redis
from redis.exceptions import LockNotOwnedError

from app.adapters.factory import build_adapter_registry
from app.adapters.registry import AdapterNotFound
from app.core.config import get_settings
from app.db.session import get_session_factory
from app.notifications.telegram import PermanentNotificationError, TelegramClient
from app.queue import broker
from app.services.monitor_runs import MonitoringRunService
from app.services.monitoring import MonitoringService
from app.services.notifications import NotificationNotFound, NotificationService
from app.services.search_monitors import SearchMonitorNotFound


async def _run_monitor_check(monitor_id: str) -> None:
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
        started_at = datetime.now(UTC)
        try:
            async with get_session_factory()() as session:
                result = await MonitoringService(
                    session=session,
                    registry=build_adapter_registry(),
                ).run(parsed_id)
                pending_ids = await NotificationService(session).pending_ids_for_monitor(parsed_id)
        except Exception as exc:
            finished_at = datetime.now(UTC)
            async with get_session_factory()() as telemetry_session:
                await MonitoringRunService(telemetry_session).record_failure(
                    parsed_id,
                    started_at=started_at,
                    finished_at=finished_at,
                    error=exc,
                )
            raise
        else:
            finished_at = datetime.now(UTC)
            async with get_session_factory()() as telemetry_session:
                await MonitoringRunService(telemetry_session).record_success(
                    parsed_id,
                    started_at=started_at,
                    finished_at=finished_at,
                    result=result,
                )
            for notification_id in pending_ids:
                send_notification.send(str(notification_id))
    finally:
        try:
            if await lock.owned():
                await lock.release()
        except LockNotOwnedError:
            pass
        await redis.aclose()


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
    await _run_monitor_check(monitor_id)


@dramatiq.actor(
    broker=broker,
    queue_name="monitoring-fast",
    max_retries=5,
    min_backoff=2_000,
    max_backoff=30_000,
    time_limit=60_000,
    throws=(AdapterNotFound, SearchMonitorNotFound),
)
async def check_monitor_fast(monitor_id: str) -> None:
    await _run_monitor_check(monitor_id)


@dramatiq.actor(
    broker=broker,
    queue_name="monitoring-realtime",
    max_retries=3,
    min_backoff=1_000,
    max_backoff=10_000,
    time_limit=30_000,
    throws=(AdapterNotFound, SearchMonitorNotFound),
)
async def check_monitor_realtime(monitor_id: str) -> None:
    await _run_monitor_check(monitor_id)


@dramatiq.actor(
    broker=broker,
    queue_name="notifications",
    max_retries=5,
    min_backoff=5_000,
    max_backoff=60_000,
    time_limit=30_000,
    throws=(NotificationNotFound, PermanentNotificationError),
)
async def send_notification(notification_id: str) -> None:
    parsed_id = uuid.UUID(notification_id)
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url)
    lock = redis.lock(
        f"lootly:notification-lock:{parsed_id}",
        timeout=30,
        blocking_timeout=0,
    )
    acquired = await lock.acquire(blocking=False)
    if not acquired:
        await redis.aclose()
        return

    try:
        async with get_session_factory()() as session:
            service = NotificationService(session)
            notification = await service.get_pending(parsed_id)
            if notification is None:
                return

            client = TelegramClient(
                token=settings.telegram_bot_token,
                timeout_seconds=settings.telegram_timeout_seconds,
            )
            try:
                await client.send_message(notification.chat_id, notification.message_text)
            except PermanentNotificationError as exc:
                await service.mark_failed(notification, str(exc))
                await session.commit()
                raise
            except Exception as exc:
                await service.mark_retry(notification, str(exc))
                await session.commit()
                raise
            else:
                await service.mark_sent(notification)
                await session.commit()
    finally:
        try:
            if await lock.owned():
                await lock.release()
        except LockNotOwnedError:
            pass
        await redis.aclose()
