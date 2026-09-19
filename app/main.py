from fastapi import FastAPI

from app.api.routes.analytics import router as analytics_router
from app.api.routes.auth import router as auth_router
from app.api.routes.booking import router as booking_router
from app.api.routes.catalog import router as catalog_router
from app.api.routes.health import router as health_router
from app.api.routes.public_booking import router as public_booking_router
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.2.0")
app.include_router(health_router)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(catalog_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(public_booking_router, prefix="/api/v1")
app.include_router(booking_router, prefix="/api/v1")
