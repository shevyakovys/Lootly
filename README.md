# Lootly

Lootly — SaaS-платформа онлайн-бронирования для сервисного бизнеса.

## Публичная версия

Текущий бесплатный production deployment работает на Supabase:

**https://tccmnfuwambjbsbmozdl.supabase.co/functions/v1/web**

Архитектура production:

- Supabase Edge Function — web UI;
- Supabase Auth — owner/admin/staff authentication;
- PostgreSQL + RLS — данные и tenant isolation;
- PostgreSQL RPC — availability и атомарное бронирование;
- notification outbox — подтверждения и reminders.

## Основные сценарии

- создание организации и owner-аккаунта;
- филиалы, сотрудники, услуги и клиенты;
- назначение услуг сотрудникам;
- рабочие часы и time off;
- свободные слоты с timezone;
- публичная онлайн-запись;
- защита от двойного бронирования;
- журнал, перенос, отмена и статусы;
- owner/admin/staff роли;
- приглашения команды;
- операционная аналитика;
- notification outbox.

## Публичная запись

Для организации со slug `my-studio`:

```text
https://tccmnfuwambjbsbmozdl.supabase.co/functions/v1/web#/book/my-studio
```

## Репозиторий

Legacy FastAPI/Next.js implementation remains in the repository as the original self-hosted
implementation. The current zero-cost hosted production runtime is Supabase.

Документация:

- `docs/BUSINESS_REQUIREMENTS.md`
- `docs/TECHNICAL_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT_SUPABASE.md`
- `docs/SUPABASE_SCHEMA.md`
- `AGENTS.md`
