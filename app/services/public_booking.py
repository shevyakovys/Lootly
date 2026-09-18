from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    Customer,
    Location,
    Organization,
    Service,
    StaffMember,
    StaffService,
)
from app.domain.schemas import (
    AppointmentCreate,
    PublicAvailabilitySlot,
    PublicBookingCreate,
)
from app.services.appointments import AppointmentService
from app.services.availability import AvailabilityService


class PublicBookingNotFound(LookupError):
    pass


class PublicBookingValidationError(ValueError):
    pass


class PublicBookingService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def organization(self, slug: str) -> Organization:
        item = await self.session.scalar(
            select(Organization).where(Organization.slug == slug)
        )
        if item is None:
            raise PublicBookingNotFound(slug)
        return item

    async def locations(self, organization_id: uuid.UUID) -> list[Location]:
        result = await self.session.scalars(
            select(Location)
            .where(
                Location.organization_id == organization_id,
                Location.active.is_(True),
            )
            .order_by(Location.name.asc())
        )
        return list(result.all())

    async def services(self, organization_id: uuid.UUID) -> list[Service]:
        result = await self.session.scalars(
            select(Service)
            .where(
                Service.organization_id == organization_id,
                Service.active.is_(True),
            )
            .order_by(Service.name.asc())
        )
        return list(result.all())

    async def staff(
        self,
        *,
        organization_id: uuid.UUID,
        location_id: uuid.UUID,
        service_id: uuid.UUID,
    ) -> list[StaffMember]:
        result = await self.session.scalars(
            select(StaffMember)
            .join(StaffService, StaffService.staff_id == StaffMember.id)
            .where(
                StaffMember.organization_id == organization_id,
                StaffMember.location_id == location_id,
                StaffMember.active.is_(True),
                StaffService.service_id == service_id,
            )
            .order_by(StaffMember.name.asc())
        )
        return list(result.all())

    async def availability(
        self,
        *,
        organization_id: uuid.UUID,
        location_id: uuid.UUID,
        service_id: uuid.UUID,
        day: date,
        staff_id: uuid.UUID | None = None,
    ) -> list[PublicAvailabilitySlot]:
        staff_members = await self.staff(
            organization_id=organization_id,
            location_id=location_id,
            service_id=service_id,
        )
        if staff_id is not None:
            staff_members = [item for item in staff_members if item.id == staff_id]
            if not staff_members:
                raise PublicBookingValidationError("staff not available for service")

        result: list[PublicAvailabilitySlot] = []
        availability = AvailabilityService(self.session)
        for staff in staff_members:
            slots = await availability.slots(
                location_id=location_id,
                service_id=service_id,
                staff_id=staff.id,
                day=day,
            )
            result.extend(
                PublicAvailabilitySlot(
                    staff_id=staff.id,
                    start_at=slot.start_at,
                    end_at=slot.end_at,
                )
                for slot in slots
            )

        result.sort(key=lambda item: (item.start_at, str(item.staff_id)))
        return result

    async def book(self, slug: str, payload: PublicBookingCreate):
        organization = await self.organization(slug)
        location = await self.session.get(Location, payload.location_id)
        service = await self.session.get(Service, payload.service_id)
        staff = await self.session.get(StaffMember, payload.staff_id)
        if location is None or service is None or staff is None:
            raise PublicBookingValidationError("booking option not found")
        if any(
            item.organization_id != organization.id
            for item in (location, service, staff)
        ):
            raise PublicBookingValidationError("booking option belongs to another organization")

        customer = await self.session.scalar(
            select(Customer).where(
                Customer.organization_id == organization.id,
                Customer.phone == payload.customer_phone,
            )
        )
        if customer is None:
            customer = Customer(
                organization_id=organization.id,
                name=payload.customer_name,
                phone=payload.customer_phone,
                email=payload.customer_email,
            )
            self.session.add(customer)
            await self.session.flush()
        else:
            customer.name = payload.customer_name
            if payload.customer_email is not None:
                customer.email = payload.customer_email

        return await AppointmentService(self.session).create(
            AppointmentCreate(
                organization_id=organization.id,
                location_id=payload.location_id,
                staff_id=payload.staff_id,
                service_id=payload.service_id,
                customer_id=customer.id,
                start_at=payload.start_at,
                note=payload.note,
                booking_key=payload.booking_key,
            )
        )
