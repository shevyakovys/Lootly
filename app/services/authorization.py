from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import (
    AdminUser,
    Appointment,
    Customer,
    Location,
    Service,
    StaffMember,
)


class TenantAccessDenied(PermissionError):
    pass


def require_manager(user: AdminUser) -> None:
    if user.role not in {"owner", "admin"}:
        raise TenantAccessDenied("manager role required")


def require_organization(user: AdminUser, organization_id: uuid.UUID) -> None:
    if user.organization_id != organization_id:
        raise TenantAccessDenied("cross-organization access denied")


class TenantGuard:
    def __init__(self, session: AsyncSession, user: AdminUser) -> None:
        self.session = session
        self.user = user

    async def staff(self, staff_id: uuid.UUID) -> StaffMember:
        item = await self.session.get(StaffMember, staff_id)
        if item is None or item.organization_id != self.user.organization_id:
            raise TenantAccessDenied("staff not found")
        return item

    async def location(self, location_id: uuid.UUID) -> Location:
        item = await self.session.get(Location, location_id)
        if item is None or item.organization_id != self.user.organization_id:
            raise TenantAccessDenied("location not found")
        return item

    async def service(self, service_id: uuid.UUID) -> Service:
        item = await self.session.get(Service, service_id)
        if item is None or item.organization_id != self.user.organization_id:
            raise TenantAccessDenied("service not found")
        return item

    async def customer(self, customer_id: uuid.UUID) -> Customer:
        item = await self.session.get(Customer, customer_id)
        if item is None or item.organization_id != self.user.organization_id:
            raise TenantAccessDenied("customer not found")
        return item

    async def appointment(self, appointment_id: uuid.UUID) -> Appointment:
        item = await self.session.get(Appointment, appointment_id)
        if item is None or item.organization_id != self.user.organization_id:
            raise TenantAccessDenied("appointment not found")
        if self.user.role == "staff" and item.staff_id != self.user.staff_id:
            raise TenantAccessDenied("appointment not available for staff")
        return item
