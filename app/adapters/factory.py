from app.adapters.registry import AdapterRegistry


def build_adapter_registry() -> AdapterRegistry:
    """Build the registry used by background workers.

    Concrete marketplace adapters are registered here as they are implemented.
    """

    return AdapterRegistry()
