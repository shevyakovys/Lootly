import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import SearchMonitor, User
from app.services.scheduler import PollingTier, SchedulerService, polling_tier


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    database_url = os.environ["LOOTLY_DATABASE_URL"]
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text("TRUNCATE search_monitors, users RESTART IDENTITY CASCADE")
        )

    async with factory() as db_session:
        yield db_session
        await db_session.rollback()

    await engine.dispose()


def test_polling_tier_boundaries() -> None:
    assert polling_tier(500) is PollingTier.REALTIME
    assert polling_tier(1_000) is PollingTier.REALTIME
    assert polling_tier(1_001) is PollingTier.FAST
    assert polling_tier(5_000) is PollingTier.FAST
    assert polling_tier(5_001) is PollingTier.STANDARD


@pytest.mark.asyncio
async def test_claim_due_supports_subsecond_schedule(session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    monitor_id = uuid.uuid4()
    due_at = datetime.now(UTC) - timedelta(seconds=1)

    session.add(User(id=user_id, email="scheduler@example.com"))
    session.add(
        SearchMonitor(
            id=monitor_id,
            user_id=user_id,
            source="fake",
            name="Scheduler test",
            query_url="https://example.com/search",
            poll_interval_ms=500,
            next_check_at=due_at,
        )
    )
    await session.commit()

    before = datetime.now(UTC)
    claimed = await SchedulerService(session).claim_due(limit=10)
    monitor = await session.get(SearchMonitor, monitor_id)

    assert len(claimed) == 1
    assert claimed[0].monitor_id == monitor_id
    assert claimed[0].tier is PollingTier.REALTIME
    assert monitor is not None
    delta_ms = (monitor.next_check_at - before).total_seconds() * 1000
    assert 300 <= delta_ms <= 800
