from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
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
from app.domain.schemas import AppointmentCreate, AppointmentReschedule
from app.services.availability import AvailabilityService


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

        available = await AvailabilityService(self.session).interval_is_available(
            location_id=payload.location_id,
            service_id=payload.service_id,
            staff_id=payload.staff_id,
            start_at=start_at,
            end_at=end_at,
        )
        if not available:
            raise AppointmentConflict("requested time is not available")

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
        return await self.set_status(appointment_id, "canceled")


    async def get(self, appointment_id: uuid.UUID) -> Appointment:
        item = await self.session.get(Appointment, appointment_id)
        if item is None:
            raise LookupError(str(appointment_id))
        return item

    async def list(
        self,
        *,
        organization_id: uuid.UUID,
        start_at: datetime | None = None,
        end_at: datetime | None = None,
        location_id: uuid.UUID | None = None,
        staff_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        limit: int = 200,
    ) -> list[Appointment]:
        query = (
            select(Appointment)
            .where(Appointment.organization_id == organization_id)
            .order_by(Appointment.start_at.asc())
            .limit(limit)
        )
        if start_at is not None:
            query = query.where(Appointment.end_at > start_at.astimezone(UTC))
        if end_at is not None:
            query = query.where(Appointment.start_at < end_at.astimezone(UTC))
        if location_id is not None:
            query = query.where(Appointment.location_id == location_id)
        if staff_id is not None:
            query = query.where(Appointment.staff_id == staff_id)
        if customer_id is not None:
            query = query.where(Appointment.customer_id == customer_id)
        result = await self.session.scalars(query)
        return list(result.all())

    async def reschedule(
        self,
        appointment_id: uuid.UUID,
        payload: AppointmentReschedule,
    ) -> Appointment:
        item = await self.get(appointment_id)
        if item.status in {"completed", "canceled", "no_show"}:
            raise AppointmentValidationError("appointment cannot be rescheduled")

        location = await self.session.get(Location, item.location_id)
        if location is None:
            raise AppointmentValidationError("location not found")

        start_at = payload.start_at.astimezone(UTC)
        end_at = start_at + timedelta(minutes=item.duration_minutes)
        local_day = start_at.astimezone(ZoneInfo(location.timezone)).date()
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(:key)"),
            {"key": _lock_key(item.staff_id, local_day.isoformat())},
        )

        available = await AvailabilityService(self.session).interval_is_available(
            location_id=item.location_id,
            service_id=item.service_id,
            staff_id=item.staff_id,
            start_at=start_at,
            end_at=end_at,
            exclude_appointment_id=item.id,
        )
        if not available:
            raise AppointmentConflict("requested time is not available")

        item.start_at = start_at
        item.end_at = end_at
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def set_status(self, appointment_id: uuid.UUID, status: str) -> Appointment:
        item = await self.get(appointment_id)
        allowed_transitions = {
            "booked": {"confirmed", "canceled", "completed", "no_show"},
            "confirmed": {"canceled", "completed", "no_show"},
            "completed": set(),
            "canceled": set(),
            "no_show": set(),
        }
        if status == item.status:
            return item
        if status not in allowed_transitions.get(item.status, set()):
            raise AppointmentValidationError(
                f"cannot change appointment status from {item.status} to {status}"
            )
        item.status = status
        await self.session.commit()
        await self.session.refresh(item)
        return item
