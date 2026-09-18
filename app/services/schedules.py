from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import StaffMember, TimeOff, WorkingHours
from app.domain.schemas import TimeOffCreate, WorkingHoursCreate


class ScheduleValidationError(ValueError):
    pass


class ScheduleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_working_hours(self, payload: WorkingHoursCreate) -> WorkingHours:
        staff = await self.session.get(StaffMember, payload.staff_id)
        if staff is None or not staff.active:
            raise ScheduleValidationError("staff not available")

        item = WorkingHours(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def create_time_off(self, payload: TimeOffCreate) -> TimeOff:
        staff = await self.session.get(StaffMember, payload.staff_id)
        if staff is None or not staff.active:
            raise ScheduleValidationError("staff not available")

        item = TimeOff(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item
