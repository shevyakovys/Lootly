import pytest

from app.adapters.base import (
    MarketplaceAdapter,
    SourceAccessPolicy,
    SourceCapabilities,
    SourceComplianceError,
)
from app.adapters.registry import AdapterAlreadyRegistered, AdapterNotFound, AdapterRegistry
from app.domain.monitoring import MonitorQuery, NormalizedListing


class FakeAdapter(MarketplaceAdapter):
    source = "fake"

    def capabilities(self) -> SourceCapabilities:
        return SourceCapabilities(True, True, True)

    def access_policy(self) -> SourceAccessPolicy:
        return SourceAccessPolicy(
            automated_collection_allowed=True,
            evidence="test fixture",
            reviewed_at="2026-09-18",
        )

    async def validate_monitor(self, monitor: MonitorQuery) -> None:
        return None

    async def fetch_listings(self, monitor: MonitorQuery) -> list[NormalizedListing]:
        return []


class BlockedAdapter(FakeAdapter):
    source = "blocked"

    def access_policy(self) -> SourceAccessPolicy:
        return SourceAccessPolicy(
            automated_collection_allowed=False,
            evidence="automated collection is not authorized",
            reviewed_at="2026-09-18",
        )


def test_registry_returns_registered_adapter() -> None:
    registry = AdapterRegistry()
    adapter = FakeAdapter()
    registry.register(adapter)

    assert registry.get("FAKE") is adapter
    assert registry.sources() == ("fake",)


def test_registry_rejects_duplicate_source() -> None:
    registry = AdapterRegistry()
    registry.register(FakeAdapter())

    with pytest.raises(AdapterAlreadyRegistered):
        registry.register(FakeAdapter())


def test_registry_rejects_source_without_collection_authorization() -> None:
    registry = AdapterRegistry()

    with pytest.raises(SourceComplianceError):
        registry.register(BlockedAdapter())


def test_registry_reports_missing_source() -> None:
    with pytest.raises(AdapterNotFound):
        AdapterRegistry().get("missing")
