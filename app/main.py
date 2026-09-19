from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.booking import router as booking_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.health import router as health_router
from app.api.routes.public_booking import router as public_booking_router
from app.core.config import get_settings
from app.core.rate_limit import PublicRateLimitMiddleware

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.2.0")
app.add_middleware(
    PublicRateLimitMiddleware,
    limit=settings.public_rate_limit_per_minute,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(public_booking_router, prefix="/api/v1")
app.include_router(booking_router, prefix="/api/v1")
