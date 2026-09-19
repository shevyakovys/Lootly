import asyncio
import os
import uuid
from datetime import UTC, datetime, time
from decimal import Decimal

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.domain.models import (
    Customer,
    Location,
    Organization,
    Service,
    StaffMember,
    StaffService,
    WorkingHours,
)
from app.domain.schemas import AppointmentCreate
from app.services.appointments import AppointmentConflict, AppointmentService


@pytest.mark.asyncio
async def test_concurrent_booking_allows_only_one_writer() -> None:
    engine = create_async_engine(os.environ["LOOTLY_DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE public_booking_events, notification_outbox, admin_users, "
                "appointments, time_off, working_hours, staff_services, customers, "
                "services, staff_members, locations, organizations "
                "RESTART IDENTITY CASCADE"
            )
        )

    async with factory() as seed_session:
        org_id = uuid.uuid4()
        location_id = uuid.uuid4()
        staff_id = uuid.uuid4()
        service_id = uuid.uuid4()
        customer_id = uuid.uuid4()

        seed_session.add(Organization(id=org_id, name="Concurrent", slug="concurrent"))
        await seed_session.flush()
        seed_session.add(
            Location(
                id=location_id,
                organization_id=org_id,
                name="Main",
                timezone="UTC",
            )
        )
        await seed_session.flush()
        seed_session.add_all(
            [
                StaffMember(
                    id=staff_id,
                    organization_id=org_id,
                    location_id=location_id,
                    name="Anna",
                ),
                Service(
                    id=service_id,
                    organization_id=org_id,
                    name="Cut",
                    duration_minutes=60,
                    price=Decimal("1000"),
                ),
                Customer(
                    id=customer_id,
                    organization_id=org_id,
                    name="Ivan",
                    phone="+70000000006",
                ),
            ]
        )
        await seed_session.flush()
        seed_session.add(StaffService(staff_id=staff_id, service_id=service_id))
        seed_session.add(
            WorkingHours(
                staff_id=staff_id,
                weekday=3,
                start_time=time(9, 0),
                end_time=time(18, 0),
            )
        )
        await seed_session.commit()

    payload = AppointmentCreate(
        organization_id=org_id,
        location_id=location_id,
        staff_id=staff_id,
        service_id=service_id,
        customer_id=customer_id,
        start_at=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
    )

    async def attempt() -> str:
        async with factory() as session:
            try:
                await AppointmentService(session).create(payload)
            except AppointmentConflict:
                return "conflict"
            return "created"

    results = await asyncio.gather(attempt(), attempt())

    assert sorted(results) == ["conflict", "created"]
    await engine.dispose()
