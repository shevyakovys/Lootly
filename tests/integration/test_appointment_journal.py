import os
import uuid
from datetime import UTC, datetime, time
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
    WorkingHours,
)
from app.domain.schemas import AppointmentCreate, AppointmentReschedule
from app.services.appointments import (
    AppointmentConflict,
    AppointmentService,
    AppointmentValidationError,
)


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

    session.add(Organization(id=org_id, name="Studio", slug="journal"))
    await session.flush()
    session.add(
        Location(
            id=location_id,
            organization_id=org_id,
            name="Main",
            timezone="UTC",
        )
    )
    await session.flush()
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
            phone="+70000000002",
        )
    )
    await session.flush()
    session.add(StaffService(staff_id=staff_id, service_id=service_id))
    session.add(
        WorkingHours(
            staff_id=staff_id,
            weekday=3,
            start_time=time(9, 0),
            end_time=time(18, 0),
        )
    )
    await session.commit()
    return org_id, location_id, staff_id, service_id, customer_id


@pytest.mark.asyncio
async def test_reschedule_and_status_lifecycle(session: AsyncSession) -> None:
    org_id, location_id, staff_id, service_id, customer_id = await seed(session)
    service = AppointmentService(session)
    item = await service.create(
        AppointmentCreate(
            organization_id=org_id,
            location_id=location_id,
            staff_id=staff_id,
            service_id=service_id,
            customer_id=customer_id,
            start_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
        )
    )

    moved = await service.reschedule(
        item.id,
        AppointmentReschedule(
            start_at=datetime(2026, 10, 1, 12, 0, tzinfo=UTC)
        ),
    )
    assert moved.start_at == datetime(2026, 10, 1, 12, 0, tzinfo=UTC)

    confirmed = await service.set_status(item.id, "confirmed")
    assert confirmed.status == "confirmed"
    completed = await service.set_status(item.id, "completed")
    assert completed.status == "completed"

    with pytest.raises(AppointmentValidationError):
        await service.set_status(item.id, "canceled")


@pytest.mark.asyncio
async def test_reschedule_rejects_occupied_slot(session: AsyncSession) -> None:
    org_id, location_id, staff_id, service_id, customer_id = await seed(session)
    service = AppointmentService(session)

    first = await service.create(
        AppointmentCreate(
            organization_id=org_id,
            location_id=location_id,
            staff_id=staff_id,
            service_id=service_id,
            customer_id=customer_id,
            start_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
        )
    )
    second = await service.create(
        AppointmentCreate(
            organization_id=org_id,
            location_id=location_id,
            staff_id=staff_id,
            service_id=service_id,
            customer_id=customer_id,
            start_at=datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
        )
    )

    with pytest.raises(AppointmentConflict):
        await service.reschedule(
            second.id,
            AppointmentReschedule(
                start_at=datetime(2026, 10, 1, 10, 30, tzinfo=UTC)
            ),
        )

    assert first.start_at == datetime(2026, 10, 1, 10, 0, tzinfo=UTC)


@pytest.mark.asyncio
async def test_journal_filters_customer(session: AsyncSession) -> None:
    org_id, location_id, staff_id, service_id, customer_id = await seed(session)
    service = AppointmentService(session)
    await service.create(
        AppointmentCreate(
            organization_id=org_id,
            location_id=location_id,
            staff_id=staff_id,
            service_id=service_id,
            customer_id=customer_id,
            start_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
        )
    )

    rows = await service.list(
        organization_id=org_id,
        customer_id=customer_id,
    )

    assert len(rows) == 1
    assert rows[0].customer_id == customer_id
