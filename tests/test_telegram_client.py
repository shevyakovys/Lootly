import httpx
import pytest

from app.notifications.telegram import (
    PermanentNotificationError,
    TelegramClient,
    TemporaryNotificationError,
)


@pytest.mark.asyncio
async def test_send_message_posts_expected_payload() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/sendMessage")
        assert b'"chat_id":"123"' in request.content
        return httpx.Response(200, json={"ok": True, "result": {}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        telegram = TelegramClient("token", client=client)
        await telegram.send_message("123", "hello")


@pytest.mark.asyncio
async def test_rate_limit_is_temporary() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={"ok": False})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        telegram = TelegramClient("token", client=client)
        with pytest.raises(TemporaryNotificationError):
            await telegram.send_message("123", "hello")


@pytest.mark.asyncio
async def test_missing_token_is_permanent() -> None:
    telegram = TelegramClient(None)

    with pytest.raises(PermanentNotificationError):
        await telegram.send_message("123", "hello")
