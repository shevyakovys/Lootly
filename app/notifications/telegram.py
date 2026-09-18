from __future__ import annotations

import httpx


class NotificationDeliveryError(RuntimeError):
    pass


class TemporaryNotificationError(NotificationDeliveryError):
    pass


class PermanentNotificationError(NotificationDeliveryError):
    pass


class TelegramClient:
    def __init__(
        self,
        token: str | None,
        *,
        timeout_seconds: float = 10.0,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.token = token
        self.timeout_seconds = timeout_seconds
        self.client = client

    async def send_message(self, chat_id: str, text: str) -> None:
        if not self.token:
            raise PermanentNotificationError("Telegram bot token is not configured")

        owns_client = self.client is None
        client = self.client or httpx.AsyncClient(timeout=self.timeout_seconds)
        try:
            try:
                response = await client.post(
                    f"https://api.telegram.org/bot{self.token}/sendMessage",
                    json={"chat_id": chat_id, "text": text},
                )
            except httpx.RequestError as exc:
                raise TemporaryNotificationError("Telegram request failed") from exc

            if response.status_code == 429 or response.status_code >= 500:
                raise TemporaryNotificationError(
                    f"Telegram temporary HTTP error {response.status_code}"
                )
            if response.status_code >= 400:
                raise PermanentNotificationError(
                    f"Telegram HTTP error {response.status_code}"
                )

            payload = response.json()
            if payload.get("ok") is not True:
                raise PermanentNotificationError("Telegram rejected the message")
        finally:
            if owns_client:
                await client.aclose()
