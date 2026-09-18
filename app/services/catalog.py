import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models import Customer, Location, Organization, Service, StaffMember, StaffService
from app.domain.schemas import (
    CustomerCreate,
    LocationCreate,
    OrganizationCreate,
    ServiceCreate,
    StaffCreate,
)


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
        item = Location(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def create_staff(self, payload: StaffCreate) -> StaffMember:
        item = StaffMember(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def create_service(self, payload: ServiceCreate) -> Service:
        item = Service(**payload.model_dump())
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item

    async def create_customer(self, payload: CustomerCreate) -> Customer:
        item = Customer(**payload.model_dump())
        self.session.add(item)
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

        item = StaffService(staff_id=staff_id, service_id=service_id)
        self.session.add(item)
        await self.session.commit()
        await self.session.refresh(item)
        return item
