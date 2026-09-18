import os
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.domain.models import Listing, MonitorListing, PriceStatistic, SearchMonitor, User
from app.services.search_results import SearchResultsService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(os.environ["LOOTLY_DATABASE_URL"])
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as connection:
        await connection.execute(
            text(
                "TRUNCATE notifications, price_statistics, monitor_listings, "
                "listing_snapshots, listings, search_monitors, users "
                "RESTART IDENTITY CASCADE"
            )
        )

    async with factory() as db_session:
        yield db_session
        await db_session.rollback()

    await engine.dispose()


@pytest.mark.asyncio
async def test_results_are_ordered_and_can_filter_by_score(session: AsyncSession) -> None:
    user_id = uuid.uuid4()
    monitor_id = uuid.uuid4()
    now = datetime.now(UTC)

    session.add(User(id=user_id, email="results@example.com"))
    session.add(
        SearchMonitor(
            id=monitor_id,
            user_id=user_id,
            source="fake",
            name="Results",
            query_url="https://example.com/search",
        )
    )
    await session.flush()

    for index, score in enumerate((Decimal("4.00"), Decimal("8.00"))):
        listing_id = uuid.uuid4()
        session.add(
            Listing(
                id=listing_id,
                source="fake",
                external_id=f"result-{index}",
                title=f"Result {index}",
                price=Decimal("100"),
                url=f"https://example.com/items/{index}",
            )
        )
        await session.flush()
        session.add(
            MonitorListing(
                id=uuid.uuid4(),
                monitor_id=monitor_id,
                listing_id=listing_id,
                first_matched_at=now + timedelta(seconds=index),
                last_matched_at=now + timedelta(seconds=index),
            )
        )
        session.add(
            PriceStatistic(
                id=uuid.uuid4(),
                monitor_id=monitor_id,
                listing_id=listing_id,
                market_median=Decimal("120"),
                discount_pct=Decimal("16.67"),
                deal_score=score,
                sample_size=10,
                confidence=Decimal("0.50"),
                risk_flags=[],
            )
        )

    await session.commit()

    service = SearchResultsService(session)
    all_rows = await service.list_for_monitor(monitor_id)
    filtered = await service.list_for_monitor(
        monitor_id,
        min_deal_score=Decimal("7"),
    )

    assert [row.listing.external_id for row in all_rows] == ["result-1", "result-0"]
    assert [row.listing.external_id for row in filtered] == ["result-1"]
    assert filtered[0].statistics is not None
    assert filtered[0].statistics.deal_score == Decimal("8.00")
