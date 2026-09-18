from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.domain.models import Appointment, Location, Service, StaffService, TimeOff, WorkingHours
from app.domain.schemas import AvailabilitySlot

BLOCKING_STATUSES = {"booked", "confirmed"}


class AvailabilityError(ValueError):
    pass


class AvailabilityService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def slots(
        self,
        *,
        location_id: uuid.UUID,
        service_id: uuid.UUID,
        staff_id: uuid.UUID,
        day: date,
    ) -> list[AvailabilitySlot]:
        location = await self.session.get(Location, location_id)
        service = await self.session.get(Service, service_id)
        if location is None or not location.active:
            raise AvailabilityError("location not available")
        if service is None or not service.active:
            raise AvailabilityError("service not available")

        assignment = await self.session.scalar(
            select(StaffService.id).where(
                StaffService.staff_id == staff_id,
                StaffService.service_id == service_id,
            )
        )
        if assignment is None:
            raise AvailabilityError("service is not assigned to staff")

        tz = ZoneInfo(location.timezone)
        local_start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
        local_end = local_start + timedelta(days=1)
        day_start_utc = local_start.astimezone(UTC)
        day_end_utc = local_end.astimezone(UTC)

        hours = list(
            (
                await self.session.scalars(
                    select(WorkingHours).where(
                        WorkingHours.staff_id == staff_id,
                        WorkingHours.weekday == day.weekday(),
                    )
                )
            ).all()
        )
        time_off = list(
            (
                await self.session.scalars(
                    select(TimeOff).where(
                        TimeOff.staff_id == staff_id,
                        TimeOff.start_at < day_end_utc,
                        TimeOff.end_at > day_start_utc,
                    )
                )
            ).all()
        )
        appointments = list(
            (
                await self.session.scalars(
                    select(Appointment).where(
                        Appointment.staff_id == staff_id,
                        Appointment.status.in_(BLOCKING_STATUSES),
                        Appointment.start_at < day_end_utc,
                        Appointment.end_at > day_start_utc,
                    )
                )
            ).all()
        )

        busy = [(item.start_at, item.end_at) for item in time_off]
        busy.extend((item.start_at, item.end_at) for item in appointments)

        duration = timedelta(minutes=service.duration_minutes)
        step = timedelta(minutes=get_settings().default_slot_step_minutes)
        result: list[AvailabilitySlot] = []

        for interval in hours:
            start_local = datetime.combine(day, interval.start_time, tzinfo=tz)
            end_local = datetime.combine(day, interval.end_time, tzinfo=tz)
            cursor = start_local.astimezone(UTC)
            end_utc = end_local.astimezone(UTC)

            while cursor + duration <= end_utc:
                candidate_end = cursor + duration
                overlaps = any(
                    cursor < busy_end and candidate_end > busy_start
                    for busy_start, busy_end in busy
                )
                if not overlaps:
                    result.append(
                        AvailabilitySlot(start_at=cursor, end_at=candidate_end)
                    )
                cursor += step

        return result

    async def interval_is_available(
        self,
        *,
        location_id: uuid.UUID,
        service_id: uuid.UUID,
        staff_id: uuid.UUID,
        start_at: datetime,
        end_at: datetime,
        exclude_appointment_id: uuid.UUID | None = None,
    ) -> bool:
        location = await self.session.get(Location, location_id)
        service = await self.session.get(Service, service_id)
        if location is None or service is None:
            return False
        if not location.active or not service.active:
            return False

        assignment = await self.session.scalar(
            select(StaffService.id).where(
                StaffService.staff_id == staff_id,
                StaffService.service_id == service_id,
            )
        )
        if assignment is None:
            return False

        tz = ZoneInfo(location.timezone)
        start_utc = start_at.astimezone(UTC)
        end_utc = end_at.astimezone(UTC)
        local_start = start_utc.astimezone(tz)
        local_end = end_utc.astimezone(tz)

        if local_start.date() != local_end.date():
            return False

        hours = list(
            (
                await self.session.scalars(
                    select(WorkingHours).where(
                        WorkingHours.staff_id == staff_id,
                        WorkingHours.weekday == local_start.weekday(),
                    )
                )
            ).all()
        )
        inside_working_hours = any(
            local_start.time() >= item.start_time
            and local_end.time() <= item.end_time
            for item in hours
        )
        if not inside_working_hours:
            return False

        blocked = await self.session.scalar(
            select(TimeOff.id).where(
                TimeOff.staff_id == staff_id,
                TimeOff.start_at < end_utc,
                TimeOff.end_at > start_utc,
            )
        )
        if blocked is not None:
            return False

        conflict_query = select(Appointment.id).where(
            Appointment.staff_id == staff_id,
            Appointment.status.in_(BLOCKING_STATUSES),
            Appointment.start_at < end_utc,
            Appointment.end_at > start_utc,
        )
        if exclude_appointment_id is not None:
            conflict_query = conflict_query.where(
                Appointment.id != exclude_appointment_id
            )
        conflict = await self.session.scalar(conflict_query)
        return conflict is None
