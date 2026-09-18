from fastapi import FastAPI

from app.api.routes.booking import router as booking_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.2.0")
app.include_router(health_router)
app.include_router(booking_router, prefix="/api/v1")
