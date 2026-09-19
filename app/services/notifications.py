from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.domain.models import Appointment, Customer, NotificationOutbox


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def enqueue_created(self, appointment: Appointment) -> None:
        customer = await self.session.get(Customer, appointment.customer_id)
        if customer is None:
            return
        recipient = customer.email or customer.phone
        await self._enqueue(
            appointment=appointment,
            event_type="booking_confirmation",
            recipient=recipient,
            message=f"Запись подтверждена на {appointment.start_at.isoformat()}",
            due_at=datetime.now(UTC),
            key=f"created:{appointment.id}",
        )
        reminder_at = appointment.start_at - timedelta(
            hours=get_settings().reminder_hours_before
        )
        if reminder_at > datetime.now(UTC):
            await self._enqueue(
                appointment=appointment,
                event_type="appointment_reminder",
                recipient=recipient,
                message=f"Напоминание о записи на {appointment.start_at.isoformat()}",
                due_at=reminder_at,
                key=f"reminder:{appointment.id}:{appointment.start_at.isoformat()}",
            )

    async def enqueue_rescheduled(self, appointment: Appointment) -> None:
        await self.cancel_pending_reminders(appointment.id)
        customer = await self.session.get(Customer, appointment.customer_id)
        if customer is None:
            return
        recipient = customer.email or customer.phone
        await self._enqueue(
            appointment=appointment,
            event_type="appointment_rescheduled",
            recipient=recipient,
            message=f"Запись перенесена на {appointment.start_at.isoformat()}",
            due_at=datetime.now(UTC),
            key=f"rescheduled:{appointment.id}:{appointment.start_at.isoformat()}",
        )
        reminder_at = appointment.start_at - timedelta(
            hours=get_settings().reminder_hours_before
        )
        if reminder_at > datetime.now(UTC):
            await self._enqueue(
                appointment=appointment,
                event_type="appointment_reminder",
                recipient=recipient,
                message=f"Напоминание о записи на {appointment.start_at.isoformat()}",
                due_at=reminder_at,
                key=f"reminder:{appointment.id}:{appointment.start_at.isoformat()}",
            )

    async def enqueue_canceled(self, appointment: Appointment) -> None:
        await self.cancel_pending_reminders(appointment.id)
        customer = await self.session.get(Customer, appointment.customer_id)
        if customer is None:
            return
        await self._enqueue(
            appointment=appointment,
            event_type="appointment_canceled",
            recipient=customer.email or customer.phone,
            message=f"Запись на {appointment.start_at.isoformat()} отменена",
            due_at=datetime.now(UTC),
            key=f"canceled:{appointment.id}",
        )

    async def cancel_pending_reminders(self, appointment_id: uuid.UUID) -> None:
        await self.session.execute(
            update(NotificationOutbox)
            .where(
                NotificationOutbox.appointment_id == appointment_id,
                NotificationOutbox.event_type == "appointment_reminder",
                NotificationOutbox.status == "pending",
            )
            .values(status="canceled")
        )

    async def _enqueue(
        self,
        *,
        appointment: Appointment,
        event_type: str,
        recipient: str,
        message: str,
        due_at: datetime,
        key: str,
    ) -> None:
        existing = await self.session.scalar(
            select(NotificationOutbox.id).where(
                NotificationOutbox.idempotency_key == key
            )
        )
        if existing is not None:
            return
        self.session.add(
            NotificationOutbox(
                organization_id=appointment.organization_id,
                appointment_id=appointment.id,
                event_type=event_type,
                recipient=recipient,
                message=message,
                due_at=due_at,
                idempotency_key=key,
            )
        )

    async def due(self, limit: int) -> list[NotificationOutbox]:
        rows = await self.session.scalars(
            select(NotificationOutbox)
            .where(
                NotificationOutbox.status == "pending",
                NotificationOutbox.due_at <= datetime.now(UTC),
            )
            .order_by(NotificationOutbox.due_at.asc())
            .with_for_update(skip_locked=True)
            .limit(limit)
        )
        return list(rows.all())

    async def list_for_organization(
        self,
        organization_id: uuid.UUID,
        limit: int = 100,
    ) -> list[NotificationOutbox]:
        rows = await self.session.scalars(
            select(NotificationOutbox)
            .where(NotificationOutbox.organization_id == organization_id)
            .order_by(NotificationOutbox.created_at.desc())
            .limit(limit)
        )
        return list(rows.all())
