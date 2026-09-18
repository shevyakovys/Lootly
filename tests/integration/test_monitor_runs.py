import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import SearchMonitor, User
from app.domain.monitoring import MonitoringRunResult
from app.services.monitor_runs import MonitoringRunService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(os.environ["LOOTLY_DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE monitoring_runs, notifications, price_statistics, "
                "monitor_listings, listing_snapshots, listings, search_monitors, users "
                "RESTART IDENTITY CASCADE"
            )
        )

    async with factory() as db_session:
        yield db_session
        await db_session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_monitoring_runs_are_listed_newest_first(session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    monitor_id = uuid.uuid4()
    session.add(User(id=user_id, email="telemetry@example.com"))
    session.add(
        SearchMonitor(
            id=monitor_id,
            user_id=user_id,
            source="fake",
            name="Telemetry",
            query_url="https://example.com/search",
        )
    )
    await session.commit()

    service = MonitoringRunService(session)
    first = datetime.now(UTC)
    await service.record_success(
        monitor_id,
        started_at=first,
        finished_at=first + timedelta(milliseconds=50),
        result=MonitoringRunResult(fetched=1),
    )
    second = first + timedelta(seconds=1)
    await service.record_success(
        monitor_id,
        started_at=second,
        finished_at=second + timedelta(milliseconds=30),
        result=MonitoringRunResult(fetched=2),
    )

    runs = await service.list_for_monitor(monitor_id)

    assert [run.fetched for run in runs] == [2, 1]
