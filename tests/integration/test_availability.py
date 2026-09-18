import os
import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import (
    Appointment,
    Customer,
    Location,
    Organization,
    Service,
    StaffMember,
    StaffService,
    TimeOff,
    WorkingHours,
)
from app.services.availability import AvailabilityService


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


@pytest.mark.asyncio
async def test_availability_excludes_time_off_and_active_appointment(
    session: AsyncSession,
) -> None:
    org_id = uuid.uuid4()
    location_id = uuid.uuid4()
    staff_id = uuid.uuid4()
    service_id = uuid.uuid4()
    customer_id = uuid.uuid4()

    session.add(Organization(id=org_id, name="Studio", slug="availability"))
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
            phone="+70000000001",
        )
    )
    await session.flush()
    session.add(StaffService(staff_id=staff_id, service_id=service_id))
    session.add(
        WorkingHours(
            staff_id=staff_id,
            weekday=3,
            start_time=time(9, 0),
            end_time=time(13, 0),
        )
    )
    session.add(
        TimeOff(
            staff_id=staff_id,
            start_at=datetime(2026, 10, 1, 11, 0, tzinfo=UTC),
            end_at=datetime(2026, 10, 1, 12, 0, tzinfo=UTC),
        )
    )
    session.add(
        Appointment(
            organization_id=org_id,
            location_id=location_id,
            staff_id=staff_id,
            service_id=service_id,
            customer_id=customer_id,
            start_at=datetime(2026, 10, 1, 9, 0, tzinfo=UTC),
            end_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
            duration_minutes=60,
            price=Decimal("2000"),
            status="booked",
        )
    )
    await session.commit()

    slots = await AvailabilityService(session).slots(
        location_id=location_id,
        service_id=service_id,
        staff_id=staff_id,
        day=date(2026, 10, 1),
    )

    starts = {slot.start_at for slot in slots}
    assert datetime(2026, 10, 1, 9, 0, tzinfo=UTC) not in starts
    assert datetime(2026, 10, 1, 11, 0, tzinfo=UTC) not in starts
    assert datetime(2026, 10, 1, 12, 0, tzinfo=UTC) in starts
