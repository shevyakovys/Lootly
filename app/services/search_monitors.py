from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import SearchMonitor
from app.domain.schemas import SearchMonitorCreate, SearchMonitorUpdate


class SearchMonitorNotFound(LookupError):
    pass


class SearchMonitorService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, payload: SearchMonitorCreate) -> SearchMonitor:
        monitor = SearchMonitor(**payload.model_dump())
        self.session.add(monitor)
        await self.session.commit()
        await self.session.refresh(monitor)
        return monitor

    async def list(self, user_id: uuid.UUID | None = None) -> list[SearchMonitor]:
        statement = select(SearchMonitor).order_by(SearchMonitor.created_at.desc())
        if user_id is not None:
            statement = statement.where(SearchMonitor.user_id == user_id)
        result = await self.session.scalars(statement)
        return list(result.all())

    async def get(self, monitor_id: uuid.UUID) -> SearchMonitor:
        monitor = await self.session.get(SearchMonitor, monitor_id)
        if monitor is None:
            raise SearchMonitorNotFound(str(monitor_id))
        return monitor

    async def update(
        self, monitor_id: uuid.UUID, payload: SearchMonitorUpdate
    ) -> SearchMonitor:
        monitor = await self.get(monitor_id)
        changes = payload.model_dump(exclude_unset=True)

        min_price = changes.get("min_price", monitor.min_price)
        max_price = changes.get("max_price", monitor.max_price)
        if min_price is not None and max_price is not None and min_price > max_price:
            raise ValueError("min_price must not exceed max_price")

        for key, value in changes.items():
            setattr(monitor, key, value)

        await self.session.commit()
        await self.session.refresh(monitor)
        return monitor

    async def delete(self, monitor_id: uuid.UUID) -> None:
        monitor = await self.get(monitor_id)
        await self.session.delete(monitor)
        await self.session.commit()
