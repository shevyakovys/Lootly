# Railway production deployment

Lootly is deployed as four Railway services:

1. `lootly-db` — Railway PostgreSQL.
2. `lootly-api` — GitHub repo root, root `Dockerfile`.
3. `lootly-worker` — same GitHub repo/root Dockerfile with custom start command.
4. `lootly-web` — GitHub repo with Root Directory `/frontend`.

Railway currently recommends configuring these as separate services in a project. A service can be
connected directly to a GitHub repository and will redeploy on pushes to the selected branch.

## API

Source:
- repository: `shevyakovys/Lootly`
- branch: `main`
- root directory: `/`

Start command: leave the Dockerfile command.

Pre-deploy command:

```text
alembic upgrade head
```

Healthcheck:

```text
/health/ready
```

Variables:

```text
LOOTLY_ENVIRONMENT=production
LOOTLY_DATABASE_URL=${{Postgres.DATABASE_URL}}
LOOTLY_AUTH_SECRET_KEY=<generated secret>
LOOTLY_FRONTEND_ORIGIN=https://<lootly-web-public-domain>
LOOTLY_NOTIFICATION_WEBHOOK_URL=
```

The settings layer automatically converts Railway's `postgresql://` / `postgres://` URL to
SQLAlchemy's `postgresql+asyncpg://` form.

Generate a public Railway domain for this service.

## Notification worker

Source:
- repository: `shevyakovys/Lootly`
- branch: `main`
- root directory: `/`

Custom start command:

```text
python -m app.workers.notifications
```

Variables:

```text
LOOTLY_ENVIRONMENT=production
LOOTLY_DATABASE_URL=${{Postgres.DATABASE_URL}}
LOOTLY_NOTIFICATION_WEBHOOK_URL=
```

This service does not need a public domain.

## Web

Source:
- repository: `shevyakovys/Lootly`
- branch: `main`
- Root Directory: `/frontend`

Dockerfile: `/frontend/Dockerfile`.

Build variable:

```text
NEXT_PUBLIC_API_URL=https://<lootly-api-public-domain>/api/v1
```

Runtime variable:

```text
PORT=3000
```

Generate a public Railway domain for this service.

After the web domain exists, update `LOOTLY_FRONTEND_ORIGIN` on the API to exactly that HTTPS origin
and redeploy the API.

## Verification

1. `GET https://<api-domain>/health/live` returns `{"status":"ok"}`.
2. `GET https://<api-domain>/health/ready` returns `{"status":"ready"}`.
3. Open `https://<web-domain>/setup` and create the first organization.
4. Sign in at `https://<web-domain>/login`.
5. Configure locations, services, staff and schedules.
6. Open the public booking page at `https://<web-domain>/book/<organization-slug>`.

## Production notes

- Do not expose PostgreSQL publicly unless external database access is required.
- Replace the development auth secret with a generated production secret.
- External SMS/email delivery remains optional and is configured through
  `LOOTLY_NOTIFICATION_WEBHOOK_URL`.
