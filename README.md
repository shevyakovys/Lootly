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


## GitHub Pages frontend

The public frontend is deployed from `site/index.html` using GitHub Pages. Supabase remains the backend, auth and database.
Expected public URL after the Pages workflow succeeds:

`https://shevyakovys.github.io/Lootly/`


## Конструктор виджетов

После входа откройте раздел **Виджеты**:

`https://shevyakovys.github.io/Lootly/#/widgets`

Для каждого виджета Lootly генерирует код вида:

```html
<script src="https://shevyakovys.github.io/Lootly/embed.js"
        data-lootly-widget="<public-widget-key>"
        async></script>
```

Код можно вставить перед `</body>` на внешнем сайте. Он создаёт брендированную кнопку онлайн-записи
и открывает форму в drawer или modal.


## Premium UI/UX

The active GitHub Pages frontend uses a responsive SaaS shell with:

- desktop sidebar and mobile bottom navigation;
- dashboard focused on today's operations;
- onboarding checklist and quick actions;
- enriched appointment journal with search and status filters;
- redesigned catalog and schedule management;
- premium widget builder with live preview;
- direct link, inline iframe and floating-button embed modes;
- widget funnel analytics: views → opens → bookings;
- guided multi-step mobile-first booking flow;
- toasts, empty states and clearer validation/error states.

Frontend source is split into `site/index.html`, `site/styles.css`, `site/app.js` and `site/embed.js`.
