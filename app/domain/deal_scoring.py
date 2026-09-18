from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal
from statistics import median

from pydantic import BaseModel, Field

PERCENT_QUANTUM = Decimal("0.01")
SCORE_QUANTUM = Decimal("0.01")
DEFAULT_MIN_SAMPLE = 5
FULL_CONFIDENCE_SAMPLE = 20


class DealScoreResult(BaseModel):
    market_median: Decimal | None = None
    discount_pct: Decimal | None = None
    deal_score: Decimal | None = None
    sample_size: int = 0
    confidence: Decimal = Field(ge=0, le=1)
    risk_flags: list[str] = Field(default_factory=list)


def calculate_deal_score(
    price: Decimal,
    comparable_prices: list[Decimal],
    *,
    min_sample: int = DEFAULT_MIN_SAMPLE,
) -> DealScoreResult:
    if price < 0:
        raise ValueError("price must be non-negative")
    if min_sample < 1:
        raise ValueError("min_sample must be positive")
    if any(item < 0 for item in comparable_prices):
        raise ValueError("comparable prices must be non-negative")

    sample_size = len(comparable_prices)
    confidence = min(
        Decimal(sample_size) / Decimal(FULL_CONFIDENCE_SAMPLE),
        Decimal("1"),
    ).quantize(SCORE_QUANTUM, rounding=ROUND_HALF_UP)

    if sample_size == 0:
        return DealScoreResult(sample_size=0, confidence=confidence)

    market_median = Decimal(median(comparable_prices))
    risk_flags: list[str] = []

    if price == 0:
        risk_flags.append("zero_price")

    if market_median <= 0:
        risk_flags.append("non_positive_market_median")
        return DealScoreResult(
            market_median=market_median,
            sample_size=sample_size,
            confidence=confidence,
            risk_flags=risk_flags,
        )

    discount_pct = (
        (market_median - price) / market_median * Decimal("100")
    ).quantize(PERCENT_QUANTUM, rounding=ROUND_HALF_UP)

    if discount_pct >= Decimal("50"):
        risk_flags.append("extreme_discount")

    if sample_size < min_sample:
        return DealScoreResult(
            market_median=market_median,
            discount_pct=discount_pct,
            sample_size=sample_size,
            confidence=confidence,
            risk_flags=risk_flags,
        )

    base_score = max(
        Decimal("0"),
        min(Decimal("10"), discount_pct / Decimal("3")),
    )
    deal_score = (base_score * confidence).quantize(
        SCORE_QUANTUM,
        rounding=ROUND_HALF_UP,
    )

    return DealScoreResult(
        market_median=market_median,
        discount_pct=discount_pct,
        deal_score=deal_score,
        sample_size=sample_size,
        confidence=confidence,
        risk_flags=risk_flags,
    )
