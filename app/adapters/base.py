from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


from app.domain.monitoring import MonitorQuery, NormalizedListing


@dataclass(frozen=True, slots=True)
class SourceCapabilities:
    supports_price_filter: bool
    supports_region_filter: bool
    supports_keyword_filter: bool


@dataclass(frozen=True, slots=True)
class SourceAccessPolicy:
    automated_collection_allowed: bool
    evidence: str
    reviewed_at: str


class AdapterError(RuntimeError):
    pass


class TemporaryAdapterError(AdapterError):
    pass


class AdapterContractError(AdapterError):
    pass


class SourceComplianceError(AdapterError):
    pass


class MarketplaceAdapter(ABC):
    source: str

    @abstractmethod
    def capabilities(self) -> SourceCapabilities:
        raise NotImplementedError

    @abstractmethod
    def access_policy(self) -> SourceAccessPolicy:
        raise NotImplementedError

    @abstractmethod
    async def validate_monitor(self, monitor: MonitorQuery) -> None:
        raise NotImplementedError

    @abstractmethod
    async def fetch_listings(self, monitor: MonitorQuery) -> list[NormalizedListing]:
        raise NotImplementedError
