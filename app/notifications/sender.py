from __future__ import annotations

import httpx
import structlog

from app.core.config import get_settings
from app.domain.models import NotificationOutbox

logger = structlog.get_logger(__name__)


class NotificationSender:
    async def send(self, notification: NotificationOutbox) -> None:
        settings = get_settings()
        if settings.notification_webhook_url is None:
            logger.info(
                "notification_delivered_locally",
                notification_id=str(notification.id),
                event_type=notification.event_type,
            )
            return

        async with httpx.AsyncClient(timeout=settings.notification_timeout_seconds) as client:
            response = await client.post(
                settings.notification_webhook_url,
                json={
                    "notification_id": str(notification.id),
                    "event_type": notification.event_type,
                    "recipient": notification.recipient,
                    "message": notification.message,
                },
            )
            response.raise_for_status()
