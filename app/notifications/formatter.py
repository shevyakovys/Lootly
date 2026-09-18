from app.domain.deal_scoring import DealScoreResult
from app.domain.models import Listing


def format_deal_message(listing: Listing, assessment: DealScoreResult) -> str:
    lines = [
        "Новый лот",
        listing.title,
        f"Цена: {listing.price} {listing.currency}",
    ]
    if assessment.market_median is not None:
        lines.append(f"Медиана рынка: {assessment.market_median} {listing.currency}")
    if assessment.discount_pct is not None:
        lines.append(f"Отклонение от медианы: {assessment.discount_pct}%")
    if assessment.deal_score is not None:
        lines.append(f"Deal Score: {assessment.deal_score}/10")
    if assessment.risk_flags:
        lines.append("Проверить: " + ", ".join(assessment.risk_flags))
    lines.append(listing.url)
    return "\n".join(lines)[:4096]
