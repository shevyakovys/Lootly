from decimal import Decimal

import pytest

from app.domain.deal_scoring import calculate_deal_score


def test_median_resists_outlier() -> None:
    result = calculate_deal_score(
        Decimal("47000"),
        [
            Decimal("57000"),
            Decimal("58000"),
            Decimal("59000"),
            Decimal("60000"),
            Decimal("61000"),
            Decimal("120000"),
        ],
    )

    assert result.market_median == Decimal("59500")
    assert result.discount_pct == Decimal("21.01")
    assert result.deal_score is not None
    assert result.deal_score > Decimal("2")


def test_small_sample_does_not_emit_deal_score() -> None:
    result = calculate_deal_score(
        Decimal("80"),
        [Decimal("100"), Decimal("105")],
    )

    assert result.market_median == Decimal("102.5")
    assert result.deal_score is None
    assert result.confidence == Decimal("0.10")


def test_price_above_market_has_zero_score() -> None:
    result = calculate_deal_score(
        Decimal("120"),
        [
            Decimal("90"),
            Decimal("95"),
            Decimal("100"),
            Decimal("105"),
            Decimal("110"),
        ],
    )

    assert result.discount_pct is not None
    assert result.discount_pct < 0
    assert result.deal_score == Decimal("0.00")


def test_extreme_discount_is_flagged() -> None:
    result = calculate_deal_score(
        Decimal("20"),
        [
            Decimal("100"),
            Decimal("100"),
            Decimal("100"),
            Decimal("100"),
            Decimal("100"),
        ],
    )

    assert "extreme_discount" in result.risk_flags


def test_negative_price_is_rejected() -> None:
    with pytest.raises(ValueError):
        calculate_deal_score(
            Decimal("-1"),
            [Decimal("100")] * 5,
        )
