from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import MonitoringRun, SearchMonitor
from app.domain.monitoring import MonitoringRunResult
from app.services.search_monitors import SearchMonitorNotFound


class MonitoringRunService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def record_success(
        self,
        monitor_id: uuid.UUID,
        *,
        started_at: datetime,
        finished_at: datetime,
        result: MonitoringRunResult,
    ) -> MonitoringRun:
        run = MonitoringRun(
            monitor_id=monitor_id,
            status="success",
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=max(0, int((finished_at - started_at).total_seconds() * 1000)),
            fetched=result.fetched,
            accepted=result.accepted,
            created=result.created,
            updated=result.updated,
            new_matches=result.new_matches,
        )
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def record_failure(
        self,
        monitor_id: uuid.UUID,
        *,
        started_at: datetime,
        finished_at: datetime,
        error: BaseException,
    ) -> MonitoringRun:
        run = MonitoringRun(
            monitor_id=monitor_id,
            status="failed",
            started_at=started_at,
            finished_at=finished_at,
            duration_ms=max(0, int((finished_at - started_at).total_seconds() * 1000)),
            error_type=type(error).__name__[:255],
        )
        self.session.add(run)
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def list_for_monitor(
        self,
        monitor_id: uuid.UUID,
        *,
        limit: int = 50,
    ) -> list[MonitoringRun]:
        if await self.session.get(SearchMonitor, monitor_id) is None:
            raise SearchMonitorNotFound(str(monitor_id))

        result = await self.session.scalars(
            select(MonitoringRun)
            .where(MonitoringRun.monitor_id == monitor_id)
            .order_by(MonitoringRun.started_at.desc())
            .limit(limit)
        )
        return list(result.all())
