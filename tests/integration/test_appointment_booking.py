import os
import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import (
    Customer,
    Location,
    Organization,
    Service,
    StaffMember,
    StaffService,
)
from app.domain.schemas import AppointmentCreate
from app.services.appointments import AppointmentConflict, AppointmentService


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


async def seed(
    session: AsyncSession,
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID, uuid.UUID]:
    org_id = uuid.uuid4()
    location_id = uuid.uuid4()
    staff_id = uuid.uuid4()
    service_id = uuid.uuid4()
    customer_id = uuid.uuid4()

    session.add(Organization(id=org_id, name="Studio", slug="studio"))
    session.add(
        Location(
            id=location_id,
            organization_id=org_id,
            name="Main",
            timezone="Europe/Moscow",
        )
    )
    session.add(
        StaffMember(
            id=staff_id,
            organization_id=org_id,
            location_id=location_id,
            name="Anna",
        )
    )
    session.add(
        Service(
            id=service_id,
            organization_id=org_id,
            name="Haircut",
            duration_minutes=60,
            price=Decimal("2000"),
        )
    )
    session.add(
        Customer(
            id=customer_id,
            organization_id=org_id,
            name="Ivan",
            phone="+70000000000",
        )
    )
    await session.flush()
    session.add(StaffService(staff_id=staff_id, service_id=service_id))
    await session.commit()
    return org_id, location_id, staff_id, service_id, customer_id


@pytest.mark.asyncio
async def test_overlapping_active_appointment_is_rejected(session: AsyncSession) -> None:
    org_id, location_id, staff_id, service_id, customer_id = await seed(session)
    service = AppointmentService(session)

    first = AppointmentCreate(
        organization_id=org_id,
        location_id=location_id,
        staff_id=staff_id,
        service_id=service_id,
        customer_id=customer_id,
        start_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
    )
    await service.create(first)

    overlapping = first.model_copy(
        update={"start_at": datetime(2026, 10, 1, 10, 30, tzinfo=UTC)}
    )
    with pytest.raises(AppointmentConflict):
        await service.create(overlapping)
