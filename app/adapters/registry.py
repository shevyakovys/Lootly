from app.adapters.base import MarketplaceAdapter


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
