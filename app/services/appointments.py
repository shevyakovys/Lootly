from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    Appointment,
    Customer,
    Location,
    Service,
    StaffMember,
    StaffService,
)
from app.domain.schemas import AppointmentCreate
from app.services.availability import BLOCKING_STATUSES


class AppointmentConflict(RuntimeError):
    pass


class AppointmentValidationError(ValueError):
    pass


def _lock_key(staff_id: uuid.UUID, local_day: str) -> int:
    digest = hashlib.blake2b(f"{staff_id}:{local_day}".encode(), digest_size=8).digest()
    return int.from_bytes(digest, signed=True)


class AppointmentService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, payload: AppointmentCreate) -> Appointment:
        if payload.booking_key:
            existing = await self.session.scalar(
                select(Appointment).where(Appointment.booking_key == payload.booking_key)
            )
            if existing is not None:
                return existing

        location = await self.session.get(Location, payload.location_id)
        staff = await self.session.get(StaffMember, payload.staff_id)
        service = await self.session.get(Service, payload.service_id)
        customer = await self.session.get(Customer, payload.customer_id)

        if location is None or staff is None or service is None or customer is None:
            raise AppointmentValidationError("booking references missing entity")
        if not location.active or not staff.active or not service.active:
            raise AppointmentValidationError("booking entity is inactive")
        if any(
            organization_id != payload.organization_id
            for organization_id in (
                location.organization_id,
                staff.organization_id,
                service.organization_id,
                customer.organization_id,
            )
        ):
            raise AppointmentValidationError("cross-organization booking is not allowed")
        if staff.location_id != payload.location_id:
            raise AppointmentValidationError("staff does not belong to location")

        assignment = await self.session.scalar(
            select(StaffService.id).where(
                StaffService.staff_id == payload.staff_id,
                StaffService.service_id == payload.service_id,
            )
        )
        if assignment is None:
            raise AppointmentValidationError("service is not assigned to staff")

        start_at = payload.start_at.astimezone(UTC)
        end_at = start_at + timedelta(minutes=service.duration_minutes)

        local_day = start_at.astimezone(ZoneInfo(location.timezone)).date()
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(:key)"),
            {"key": _lock_key(payload.staff_id, local_day.isoformat())},
        )

        conflict = await self.session.scalar(
            select(Appointment.id).where(
                Appointment.staff_id == payload.staff_id,
                Appointment.status.in_(BLOCKING_STATUSES),
                Appointment.start_at < end_at,
                Appointment.end_at > start_at,
            )
        )
        if conflict is not None:
            raise AppointmentConflict("requested time overlaps existing appointment")

        item = Appointment(
            organization_id=payload.organization_id,
            location_id=payload.location_id,
            staff_id=payload.staff_id,
            service_id=payload.service_id,
            customer_id=payload.customer_id,
            start_at=start_at,
            end_at=end_at,
            duration_minutes=service.duration_minutes,
            price=service.price,
            status="booked",
            note=payload.note,
            booking_key=payload.booking_key,
        )
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def cancel(self, appointment_id: uuid.UUID) -> Appointment:
        item = await self.session.get(Appointment, appointment_id)
        if item is None:
            raise LookupError(str(appointment_id))
        item.status = "canceled"
        await self.session.commit()
        await self.session.refresh(item)
        return item
