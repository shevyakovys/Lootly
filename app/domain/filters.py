from app.domain.models import SearchMonitor
from app.domain.monitoring import NormalizedListing


def listing_matches_monitor(listing: NormalizedListing, monitor: SearchMonitor) -> bool:
    if listing.source != monitor.source:
        return False

    if monitor.min_price is not None and listing.price < monitor.min_price:
        return False
    if monitor.max_price is not None and listing.price > monitor.max_price:
        return False

    haystack = f"{listing.title}\n{listing.description or ''}".casefold()

    if any(keyword.casefold() not in haystack for keyword in monitor.include_keywords):
        return False
    if any(keyword.casefold() in haystack for keyword in monitor.exclude_keywords):
        return False

    return True
