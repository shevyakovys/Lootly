from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import StaffMember, TimeOff, WorkingHours
from app.domain.schemas import TimeOffCreate, WorkingHoursCreate


class ScheduleValidationError(ValueError):
    pass


class ScheduleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_working_hours(self, payload: WorkingHoursCreate) -> WorkingHours:
        await self._require_staff(payload.staff_id)
        item = WorkingHours(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def create_time_off(self, payload: TimeOffCreate) -> TimeOff:
        await self._require_staff(payload.staff_id)
        item = TimeOff(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def working_hours(self, staff_id: uuid.UUID) -> list[WorkingHours]:
        rows = await self.session.scalars(
            select(WorkingHours)
            .where(WorkingHours.staff_id == staff_id)
            .order_by(WorkingHours.weekday.asc(), WorkingHours.start_time.asc())
        )
        return list(rows.all())

    async def time_off(self, staff_id: uuid.UUID) -> list[TimeOff]:
        rows = await self.session.scalars(
            select(TimeOff)
            .where(TimeOff.staff_id == staff_id)
            .order_by(TimeOff.start_at.asc())
        )
        return list(rows.all())

    async def delete_working_hours(self, item_id: uuid.UUID) -> None:
        item = await self.session.get(WorkingHours, item_id)
        if item is None:
            raise LookupError(str(item_id))
        await self.session.delete(item)
        await self.session.commit()

    async def delete_time_off(self, item_id: uuid.UUID) -> None:
        item = await self.session.get(TimeOff, item_id)
        if item is None:
            raise LookupError(str(item_id))
        await self.session.delete(item)
        await self.session.commit()

    async def _require_staff(self, staff_id: uuid.UUID) -> StaffMember:
        staff = await self.session.get(StaffMember, staff_id)
        if staff is None or not staff.active:
            raise ScheduleValidationError("staff not available")
        return staff
