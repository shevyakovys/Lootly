# Lootly

Lootly — SaaS-платформа онлайн-бронирования для сервисного бизнеса.

## Что реализовано

- организации и филиалы;
- сотрудники и услуги;
- назначение услуг сотрудникам;
- рабочие часы и time off;
- расчет свободных слотов;
- concurrency-safe создание записи;
- публичная online booking страница;
- журнал записей, перенос, отмена и статусы;
- клиентская база и история визитов;
- owner/admin/staff RBAC;
- JWT authentication;
- notification outbox, подтверждения и reminders;
- операционная аналитика;
- Next.js admin dashboard и public booking UI;
- Docker Compose и CI для backend/frontend.

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

После запуска:

- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Web: http://localhost:3000

Создайте первого владельца:

```bash
curl -X POST http://localhost:8000/api/v1/auth/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{
    "organization_name": "My Studio",
    "organization_slug": "my-studio",
    "email": "owner@example.com",
    "password": "change-this-password"
  }'
```

Затем войдите через `/login`.

Публичная запись организации со slug `my-studio`:
`http://localhost:3000/book/my-studio`.

## Уведомления

Без внешних credentials notification worker использует локальный delivery adapter и отмечает
outbox-сообщения доставленными, не логируя PII. Для реальной доставки укажите
`LOOTLY_NOTIFICATION_WEBHOOK_URL`; worker отправит JSON с recipient/message/event_type в ваш
SMS/email/messenger gateway.

## Документация

- `docs/BUSINESS_REQUIREMENTS.md`
- `docs/TECHNICAL_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `AGENTS.md`


## Public production deployment

The recommended hosted deployment is Railway. Deployment-specific settings are documented in
`docs/DEPLOYMENT_RAILWAY.md`.
