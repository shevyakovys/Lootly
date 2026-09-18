import dramatiq
from dramatiq.brokers.redis import RedisBroker
from dramatiq.middleware import AsyncIO

from app.core.config import get_settings


def build_broker() -> RedisBroker:
    broker = RedisBroker(  # type: ignore[no-untyped-call]
        url=get_settings().redis_url,
        namespace="lootly",
    )
    broker.add_middleware(AsyncIO())
    return broker


broker = build_broker()
dramatiq.set_broker(broker)
