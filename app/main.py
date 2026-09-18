from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.routes.search_monitors import router as search_monitors_router
from app.api.routes.users import router as users_router
from app.core.config import get_settings

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
app.include_router(health_router)
app.include_router(users_router, prefix="/api/v1")
app.include_router(search_monitors_router, prefix="/api/v1")
