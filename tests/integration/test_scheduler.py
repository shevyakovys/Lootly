import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import SearchMonitor, User
from app.services.scheduler import SchedulerService


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


@pytest.mark.asyncio
async def test_claim_due_advances_next_check(session: AsyncSession) -> None:
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
            interval_seconds=60,
            next_check_at=due_at,
        )
    )
    await session.commit()

    claimed = await SchedulerService(session).claim_due(limit=10)
    monitor = await session.get(SearchMonitor, monitor_id)

    assert claimed == [monitor_id]
    assert monitor is not None
    assert monitor.next_check_at > datetime.now(UTC)
