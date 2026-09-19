import os
import uuid
from datetime import UTC, datetime, timedelta
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
    PublicBookingEvent,
    Service,
    StaffMember,
    WorkingHours,
)
from app.services.analytics import AnalyticsService


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
async def test_analytics_counts_public_and_canceled(session: AsyncSession) -> None:
    org = Organization(id=uuid.uuid4(), name="Studio", slug="analytics")
    session.add(org)
    await session.flush()
    location = Location(id=uuid.uuid4(), organization_id=org.id, name="Main", timezone="UTC")
    session.add(location)
    await session.flush()
    staff = StaffMember(
        id=uuid.uuid4(), organization_id=org.id, location_id=location.id, name="Anna"
    )
    service = Service(
        id=uuid.uuid4(),
        organization_id=org.id,
        name="Cut",
        duration_minutes=60,
        price=Decimal("1000"),
    )
    customer = Customer(
        id=uuid.uuid4(), organization_id=org.id, name="Ivan", phone="+70000000005"
    )
    session.add_all([staff, service, customer])
    await session.flush()
    now = datetime.now(UTC)
    session.add(
        WorkingHours(
            staff_id=staff.id,
            weekday=now.weekday(),
            start_time=(now - timedelta(hours=1)).time().replace(tzinfo=None),
            end_time=(now + timedelta(hours=7)).time().replace(tzinfo=None),
        )
    )
    session.add(
        PublicBookingEvent(
            organization_id=org.id,
            session_key="analytics-session",
            event_type="page_view",
        )
    )
    session.add(
        Appointment(
            organization_id=org.id,
            location_id=location.id,
            staff_id=staff.id,
            service_id=service.id,
            customer_id=customer.id,
            start_at=now + timedelta(days=1),
            end_at=now + timedelta(days=1, hours=1),
            duration_minutes=60,
            price=Decimal("1000"),
            status="canceled",
            booking_source="public",
        )
    )
    await session.commit()

    result = await AnalyticsService(session).overview(org.id)

    assert result["bookings_created"] == 1
    assert result["public_bookings"] == 1
    assert result["canceled"] == 1
    assert result["online_booking_conversion"] == 1.0
    assert float(result["staff_utilization"]) >= 0.0
