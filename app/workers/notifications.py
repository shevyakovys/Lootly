from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import structlog

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.notifications.sender import NotificationSender
from app.services.notifications import NotificationService

logger = structlog.get_logger(__name__)


async def process_due_notifications() -> int:
    settings = get_settings()
    sender = NotificationSender()
    processed = 0

    async with get_session_factory()() as session:
        service = NotificationService(session)
        notifications = await service.due(settings.notification_batch_size)
        for notification in notifications:
            notification.attempts += 1
            try:
                await sender.send(notification)
            except Exception as exc:
                notification.last_error = type(exc).__name__
                if notification.attempts >= 5:
                    notification.status = "failed"
                logger.exception(
                    "notification_delivery_failed",
                    notification_id=str(notification.id),
                )
            else:
                notification.status = "sent"
                notification.sent_at = datetime.now(UTC)
                notification.last_error = None
                processed += 1
        await session.commit()

    return processed


async def run_worker() -> None:
    while True:
        await process_due_notifications()
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run_worker())
