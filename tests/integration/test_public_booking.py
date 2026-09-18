import os
import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import Location, Organization, Service, StaffMember, StaffService, WorkingHours
from app.domain.schemas import PublicBookingCreate
from app.services.public_booking import PublicBookingService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(os.environ["LOOTLY_DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE appointments, time_off, working_hours, staff_services, customers, "
                "services, staff_members, locations, organizations RESTART IDENTITY CASCADE"
            )
        )
    async with factory() as db_session:
        yield db_session
        await db_session.rollback()
    await engine.dispose()


async def seed(session: AsyncSession) -> tuple[Organization, Location, StaffMember, Service]:
    organization = Organization(id=uuid.uuid4(), name="Public Studio", slug="public-studio")
    session.add(organization)
    await session.flush()
    location = Location(
        id=uuid.uuid4(),
        organization_id=organization.id,
        name="Main",
        timezone="UTC",
    )
    session.add(location)
    await session.flush()
    staff = StaffMember(
        id=uuid.uuid4(),
        organization_id=organization.id,
        location_id=location.id,
        name="Anna",
    )
    service = Service(
        id=uuid.uuid4(),
        organization_id=organization.id,
        name="Haircut",
        duration_minutes=60,
        price=Decimal("2000"),
    )
    session.add_all([staff, service])
    await session.flush()
    session.add(StaffService(staff_id=staff.id, service_id=service.id))
    session.add(
        WorkingHours(
            staff_id=staff.id,
            weekday=3,
            start_time=time(9, 0),
            end_time=time(12, 0),
        )
    )
    await session.commit()
    return organization, location, staff, service


@pytest.mark.asyncio
async def test_public_availability_and_booking_reuse_customer(session: AsyncSession) -> None:
    organization, location, staff, service = await seed(session)
    public = PublicBookingService(session)

    slots = await public.availability(
        organization_id=organization.id,
        location_id=location.id,
        service_id=service.id,
        day=date(2026, 10, 1),
    )
    assert slots[0].staff_id == staff.id
    assert slots[0].start_at == datetime(2026, 10, 1, 9, 0, tzinfo=UTC)

    first = await public.book(
        organization.slug,
        PublicBookingCreate(
            location_id=location.id,
            service_id=service.id,
            staff_id=staff.id,
            start_at=datetime(2026, 10, 1, 9, 0, tzinfo=UTC),
            customer_name="Ivan",
            customer_phone="+70000000003",
        ),
    )
    second = await public.book(
        organization.slug,
        PublicBookingCreate(
            location_id=location.id,
            service_id=service.id,
            staff_id=staff.id,
            start_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
            customer_name="Ivan Updated",
            customer_phone="+70000000003",
        ),
    )

    assert first.customer_id == second.customer_id
