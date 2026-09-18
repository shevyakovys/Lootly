from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.deal_scoring import DealScoreResult
from app.domain.models import Listing, Notification, SearchMonitor, User
from app.notifications.formatter import format_deal_message


class NotificationNotFound(LookupError):
    pass


def should_notify(monitor: SearchMonitor, assessment: DealScoreResult) -> bool:
    if monitor.min_deal_score is None:
        return True
    if assessment.deal_score is None:
        return False
    return assessment.deal_score >= monitor.min_deal_score


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def enqueue_deal(
        self,
        monitor: SearchMonitor,
        listing: Listing,
        assessment: DealScoreResult,
    ) -> uuid.UUID | None:
        if not should_notify(monitor, assessment):
            return None

        user = await self.session.get(User, monitor.user_id)
        if user is None or not user.telegram_id:
            return None

        notification_id = uuid.uuid4()
        created_id = await self.session.scalar(
            insert(Notification)
            .values(
                id=notification_id,
                user_id=user.id,
                monitor_id=monitor.id,
                listing_id=listing.id,
                channel="telegram",
                chat_id=user.telegram_id,
                message_text=format_deal_message(listing, assessment),
                status="pending",
            )
            .on_conflict_do_nothing(
                constraint="uq_notifications_monitor_listing_channel"
            )
            .returning(Notification.id)
        )
        return created_id

    async def pending_ids_for_monitor(self, monitor_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.session.scalars(
            select(Notification.id).where(
                Notification.monitor_id == monitor_id,
                Notification.status == "pending",
            )
        )
        return list(result.all())

    async def get_pending(self, notification_id: uuid.UUID) -> Notification | None:
        notification = await self.session.get(Notification, notification_id)
        if notification is None:
            raise NotificationNotFound(str(notification_id))
        if notification.status != "pending":
            return None
        return notification

    async def mark_sent(self, notification: Notification) -> None:
        notification.status = "sent"
        notification.attempt_count += 1
        notification.last_error = None
        notification.sent_at = datetime.now(UTC)
        await self.session.flush()

    async def mark_retry(self, notification: Notification, error: str) -> None:
        notification.attempt_count += 1
        notification.last_error = error[:2000]
        await self.session.flush()

    async def mark_failed(self, notification: Notification, error: str) -> None:
        notification.status = "failed"
        notification.attempt_count += 1
        notification.last_error = error[:2000]
        await self.session.flush()
