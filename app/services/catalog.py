from __future__ import annotations

import uuid
from typing import TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Customer, Location, Organization, Service, StaffMember, StaffService
from app.domain.schemas import (
    CustomerCreate,
    CustomerUpdate,
    LocationCreate,
    LocationUpdate,
    OrganizationCreate,
    ServiceCreate,
    ServiceUpdate,
    StaffCreate,
    StaffUpdate,
)

CatalogModel = TypeVar("CatalogModel", Location, StaffMember, Service, Customer)


class CatalogService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create_organization(self, payload: OrganizationCreate) -> Organization:
        item = Organization(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def create_location(self, payload: LocationCreate) -> Location:
        return await self._create(Location(**payload.model_dump()))

    async def create_staff(self, payload: StaffCreate) -> StaffMember:
        return await self._create(StaffMember(**payload.model_dump()))

    async def create_service(self, payload: ServiceCreate) -> Service:
        return await self._create(Service(**payload.model_dump()))

    async def create_customer(self, payload: CustomerCreate) -> Customer:
        return await self._create(Customer(**payload.model_dump()))

    async def _create(self, item: CatalogModel) -> CatalogModel:
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def list_locations(self, organization_id: uuid.UUID) -> list[Location]:
        rows = await self.session.scalars(
            select(Location)
            .where(Location.organization_id == organization_id)
            .order_by(Location.name.asc())
        )
        return list(rows.all())

    async def list_staff(self, organization_id: uuid.UUID) -> list[StaffMember]:
        rows = await self.session.scalars(
            select(StaffMember)
            .where(StaffMember.organization_id == organization_id)
            .order_by(StaffMember.name.asc())
        )
        return list(rows.all())

    async def list_services(self, organization_id: uuid.UUID) -> list[Service]:
        rows = await self.session.scalars(
            select(Service)
            .where(Service.organization_id == organization_id)
            .order_by(Service.name.asc())
        )
        return list(rows.all())

    async def list_customers(self, organization_id: uuid.UUID) -> list[Customer]:
        rows = await self.session.scalars(
            select(Customer)
            .where(Customer.organization_id == organization_id)
            .order_by(Customer.name.asc())
        )
        return list(rows.all())

    async def update_location(self, item: Location, payload: LocationUpdate) -> Location:
        return await self._update(item, payload.model_dump(exclude_unset=True))

    async def update_staff(self, item: StaffMember, payload: StaffUpdate) -> StaffMember:
        return await self._update(item, payload.model_dump(exclude_unset=True))

    async def update_service(self, item: Service, payload: ServiceUpdate) -> Service:
        return await self._update(item, payload.model_dump(exclude_unset=True))

    async def update_customer(self, item: Customer, payload: CustomerUpdate) -> Customer:
        return await self._update(item, payload.model_dump(exclude_unset=True))

    async def _update(self, item: CatalogModel, values: dict[str, object]) -> CatalogModel:
        for field, value in values.items():
            setattr(item, field, value)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def assign_service(
        self,
        staff_id: uuid.UUID,
        service_id: uuid.UUID,
    ) -> StaffService:
        staff = await self.session.get(StaffMember, staff_id)
        service = await self.session.get(Service, service_id)
        if staff is None or service is None:
            raise ValueError("staff or service not found")
        if staff.organization_id != service.organization_id:
            raise ValueError("cross-organization assignment is not allowed")

        existing = await self.session.scalar(
            select(StaffService).where(
                StaffService.staff_id == staff_id,
                StaffService.service_id == service_id,
            )
        )
        if existing is not None:
            return existing

        item = StaffService(staff_id=staff_id, service_id=service_id)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item
