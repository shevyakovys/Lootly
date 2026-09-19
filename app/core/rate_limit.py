from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from time import monotonic
from typing import Deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp


class PublicRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, *, limit: int) -> None:
        super().__init__(app)
        self.limit = limit
        self.window_seconds = 60.0
        self._requests: dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if not request.url.path.startswith("/api/v1/public/"):
            return await call_next(request)

        host = request.client.host if request.client is not None else "unknown"
        if not await self._allow(host):
            return JSONResponse(
                status_code=429,
                content={"detail": "public booking rate limit exceeded"},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)

    async def _allow(self, key: str) -> bool:
        now = monotonic()
        cutoff = now - self.window_seconds
        async with self._lock:
            entries = self._requests[key]
            while entries and entries[0] < cutoff:
                entries.popleft()
            if len(entries) >= self.limit:
                return False
            entries.append(now)
            return True
