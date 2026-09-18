import os
import uuid
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import Listing, MonitorListing, SearchMonitor, User
from app.services.monitor_listings import MonitorListingService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    database_url = os.environ["LOOTLY_DATABASE_URL"]
    engine = create_async_engine(database_url)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE monitor_listings, listing_snapshots, listings, "
                "search_monitors, users RESTART IDENTITY CASCADE"
            )
        )

    async with factory() as db_session:
        yield db_session
        await db_session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_match_is_idempotent_per_monitor(session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    monitor_id = uuid.uuid4()
    listing_id = uuid.uuid4()

    session.add(User(id=user_id, email="matches@example.com"))
    session.add(
        SearchMonitor(
            id=monitor_id,
            user_id=user_id,
            source="fake",
            name="Match test",
            query_url="https://example.com/search",
        )
    )
    session.add(
        Listing(
            id=listing_id,
            source="fake",
            external_id="shared-listing",
            title="Shared listing",
            price=Decimal("100"),
            url="https://example.com/items/shared-listing",
        )
    )
    await session.commit()

    service = MonitorListingService(session)
    first = await service.link(monitor_id, listing_id)
    second = await service.link(monitor_id, listing_id)
    await session.commit()

    count = await session.scalar(select(func.count()).select_from(MonitorListing))

    assert first.created is True
    assert second.created is False
    assert first.match.id == second.match.id
    assert count == 1


@pytest.mark.asyncio
async def test_same_listing_can_be_new_for_two_monitors(session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    first_monitor_id = uuid.uuid4()
    second_monitor_id = uuid.uuid4()
    listing_id = uuid.uuid4()

    session.add(User(id=user_id, email="two-monitors@example.com"))
    for monitor_id in (first_monitor_id, second_monitor_id):
        session.add(
            SearchMonitor(
                id=monitor_id,
                user_id=user_id,
                source="fake",
                name=f"Monitor {monitor_id}",
                query_url="https://example.com/search",
            )
        )
    session.add(
        Listing(
            id=listing_id,
            source="fake",
            external_id="listing-for-two",
            title="Listing for two",
            price=Decimal("100"),
            url="https://example.com/items/listing-for-two",
        )
    )
    await session.commit()

    service = MonitorListingService(session)
    first = await service.link(first_monitor_id, listing_id)
    second = await service.link(second_monitor_id, listing_id)
    await session.commit()

    assert first.created is True
    assert second.created is True
