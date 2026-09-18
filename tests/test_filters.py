from decimal import Decimal
from types import SimpleNamespace

from app.domain.filters import listing_matches_monitor
from app.domain.monitoring import NormalizedListing


def make_listing(**overrides: object) -> NormalizedListing:
    data: dict[str, object] = {
        "source": "example",
        "external_id": "1",
        "title": "MacBook Air M2 16GB",
        "description": "Excellent condition",
        "price": Decimal("65000"),
        "url": "https://example.com/items/1",
    }
    data.update(overrides)
    return NormalizedListing.model_validate(data)


def make_monitor(**overrides: object) -> SimpleNamespace:
    data: dict[str, object] = {
        "source": "example",
        "min_price": Decimal("50000"),
        "max_price": Decimal("70000"),
        "include_keywords": ["macbook", "16gb"],
        "exclude_keywords": ["broken"],
    }
    data.update(overrides)
    return SimpleNamespace(**data)


def test_listing_matches_all_monitor_filters() -> None:
    assert listing_matches_monitor(make_listing(), make_monitor())  # type: ignore[arg-type]


def test_listing_rejects_excluded_keyword() -> None:
    listing = make_listing(description="Broken screen")

    assert not listing_matches_monitor(listing, make_monitor())  # type: ignore[arg-type]


def test_listing_rejects_price_outside_range() -> None:
    listing = make_listing(price=Decimal("75000"))

    assert not listing_matches_monitor(listing, make_monitor())  # type: ignore[arg-type]
