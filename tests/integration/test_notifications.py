import os
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import Appointment, Customer, Location, Organization, Service, StaffMember
from app.services.notifications import NotificationService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(os.environ["LOOTLY_DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE notification_outbox, admin_users, appointments, time_off, "
                "working_hours, staff_services, customers, services, staff_members, "
                "locations, organizations RESTART IDENTITY CASCADE"
            )
        )
    async with factory() as db_session:
        yield db_session
    await engine.dispose()


@pytest.mark.asyncio
async def test_notification_outbox_is_idempotent(session: AsyncSession) -> None:
    org = Organization(id=uuid.uuid4(), name="Studio", slug="notify")
    session.add(org)
    await session.flush()
    location = Location(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Main",
        timezone="UTC",
    )
    session.add(location)
    await session.flush()
    staff = StaffMember(
        id=uuid.uuid4(),
        organization_id=org.id,
        location_id=location.id,
        name="Anna",
    )
    service = Service(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Cut",
        duration_minutes=60,
        price=Decimal("1000"),
    )
    customer = Customer(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Ivan",
        phone="+70000000004",
    )
    session.add_all([staff, service, customer])
    await session.flush()
    appointment = Appointment(
        organization_id=org.id,
        location_id=location.id,
        staff_id=staff.id,
        service_id=service.id,
        customer_id=customer.id,
        start_at=datetime.now(UTC) + timedelta(days=2),
        end_at=datetime.now(UTC) + timedelta(days=2, hours=1),
        duration_minutes=60,
        price=Decimal("1000"),
        status="booked",
    )
    session.add(appointment)
    await session.flush()

    notifications = NotificationService(session)
    await notifications.enqueue_created(appointment)
    await notifications.enqueue_created(appointment)
    await session.commit()

    rows = await notifications.list_for_organization(org.id)

    assert {row.event_type for row in rows} == {
        "booking_confirmation",
        "appointment_reminder",
    }
