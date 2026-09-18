from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import SearchMonitor


class SchedulerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim_due(self, limit: int) -> list[uuid.UUID]:
        now = datetime.now(UTC)
        statement = (
            select(SearchMonitor)
            .where(
                SearchMonitor.enabled.is_(True),
                SearchMonitor.next_check_at <= now,
            )
            .order_by(SearchMonitor.next_check_at.asc())
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        monitors = list((await self.session.scalars(statement)).all())

        for monitor in monitors:
            monitor.next_check_at = now + timedelta(seconds=monitor.interval_seconds)

        await self.session.commit()
        return [monitor.id for monitor in monitors]

    async def release_for_retry(self, monitor_id: uuid.UUID) -> None:
        monitor = await self.session.get(SearchMonitor, monitor_id)
        if monitor is None or not monitor.enabled:
            return
        monitor.next_check_at = datetime.now(UTC)
        await self.session.commit()
