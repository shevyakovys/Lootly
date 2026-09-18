from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.base import AdapterContractError
from app.adapters.registry import AdapterRegistry
from app.domain.filters import listing_matches_monitor
from app.domain.models import SearchMonitor
from app.domain.monitoring import MonitoringRunResult, MonitorQuery
from app.services.listings import ListingService
from app.services.search_monitors import SearchMonitorNotFound


class MonitoringService:
    def __init__(self, session: AsyncSession, registry: AdapterRegistry) -> None:
        self.session = session
        self.registry = registry

    async def run(self, monitor_id: uuid.UUID) -> MonitoringRunResult:
        monitor = await self.session.get(SearchMonitor, monitor_id)
        if monitor is None:
            raise SearchMonitorNotFound(str(monitor_id))
        if not monitor.enabled:
            return MonitoringRunResult()

        adapter = self.registry.get(monitor.source)
        query = MonitorQuery(
            source=monitor.source,
            query_url=monitor.query_url,
            min_price=monitor.min_price,
            max_price=monitor.max_price,
            include_keywords=monitor.include_keywords,
            exclude_keywords=monitor.exclude_keywords,
            region=monitor.region,
        )

        await adapter.validate_monitor(query)
        listings = await adapter.fetch_listings(query)
        result = MonitoringRunResult(fetched=len(listings))
        listing_service = ListingService(self.session)

        try:
            for item in listings:
                if item.source != monitor.source:
                    raise AdapterContractError(
                        f"adapter {adapter.source} returned source {item.source}"
                    )
                if not listing_matches_monitor(item, monitor):
                    continue

                result.accepted += 1
                upsert = await listing_service.upsert(item)
                if upsert.created:
                    result.created += 1
                else:
                    result.updated += 1

            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        return result
