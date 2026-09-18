from app.adapters.base import MarketplaceAdapter, SourceComplianceError


class AdapterNotFound(LookupError):
    pass


class AdapterAlreadyRegistered(ValueError):
    pass


class AdapterRegistry:
    def __init__(self) -> None:
        self._adapters: dict[str, MarketplaceAdapter] = {}

    def register(self, adapter: MarketplaceAdapter) -> None:
        source = adapter.source.strip().lower()
        if not source:
            raise ValueError("adapter source must not be empty")

        policy = adapter.access_policy()
        if not policy.automated_collection_allowed:
            raise SourceComplianceError(
                f"automated collection for source {source} is not authorized: {policy.evidence}"
            )

        if source in self._adapters:
            raise AdapterAlreadyRegistered(source)
        self._adapters[source] = adapter

    def get(self, source: str) -> MarketplaceAdapter:
        normalized = source.strip().lower()
        try:
            return self._adapters[normalized]
        except KeyError as exc:
            raise AdapterNotFound(normalized) from exc

    def sources(self) -> tuple[str, ...]:
        return tuple(sorted(self._adapters))
