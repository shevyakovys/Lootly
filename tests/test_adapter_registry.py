import pytest

from app.adapters.base import MarketplaceAdapter, SourceCapabilities
from app.adapters.registry import AdapterAlreadyRegistered, AdapterNotFound, AdapterRegistry
from app.domain.monitoring import MonitorQuery, NormalizedListing


class FakeAdapter(MarketplaceAdapter):
    source = "fake"

    def capabilities(self) -> SourceCapabilities:
        return SourceCapabilities(True, True, True)

    async def validate_monitor(self, monitor: MonitorQuery) -> None:
        return None

    async def fetch_listings(self, monitor: MonitorQuery) -> list[NormalizedListing]:
        return []


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


def test_registry_reports_missing_source() -> None:
    with pytest.raises(AdapterNotFound):
        AdapterRegistry().get("missing")
