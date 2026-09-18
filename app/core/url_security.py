from ipaddress import ip_address
from urllib.parse import urlsplit


class UnsafeExternalUrl(ValueError):
    pass


def ensure_public_http_url(value: str) -> str:
    """Reject obviously unsafe URLs before they reach a source adapter.

    Adapters must additionally enforce an allowlist for the marketplace they implement.
    """

    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"}:
        raise UnsafeExternalUrl("Only http and https URLs are allowed")
    if not parsed.hostname:
        raise UnsafeExternalUrl("URL must contain a hostname")

    hostname = parsed.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise UnsafeExternalUrl("Localhost URLs are not allowed")

    try:
        address = ip_address(hostname)
    except ValueError:
        return value

    if not address.is_global:
        raise UnsafeExternalUrl("Private, loopback, link-local and reserved IPs are not allowed")
    return value
