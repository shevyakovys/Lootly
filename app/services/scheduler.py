from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import SearchMonitor


class PollingTier(StrEnum):
    REALTIME = "realtime"
    FAST = "fast"
    STANDARD = "standard"


@dataclass(frozen=True, slots=True)
class ClaimedMonitor:
    monitor_id: uuid.UUID
    tier: PollingTier


def polling_tier(interval_ms: int) -> PollingTier:
    if interval_ms <= 1_000:
        return PollingTier.REALTIME
    if interval_ms <= 5_000:
        return PollingTier.FAST
    return PollingTier.STANDARD


class SchedulerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def claim_due(self, limit: int) -> list[ClaimedMonitor]:
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

        claimed: list[ClaimedMonitor] = []
        for monitor in monitors:
            monitor.next_check_at = now + timedelta(milliseconds=monitor.poll_interval_ms)
            claimed.append(
                ClaimedMonitor(
                    monitor_id=monitor.id,
                    tier=polling_tier(monitor.poll_interval_ms),
                )
            )

        await self.session.commit()
        return claimed

    async def release_for_retry(self, monitor_id: uuid.UUID) -> None:
        monitor = await self.session.get(SearchMonitor, monitor_id)
        if monitor is None or not monitor.enabled:
            return
        monitor.next_check_at = datetime.now(UTC)
        await self.session.commit()
