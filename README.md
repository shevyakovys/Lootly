# Lootly

Lootly is a real-time marketplace monitoring and deal discovery service.

## Current development stage

The backend foundation now provides:

- FastAPI application;
- PostgreSQL persistence with SQLAlchemy 2.x;
- Alembic migrations;
- Redis in the local development stack;
- User and SearchMonitor APIs;
- marketplace adapter contract and adapter registry;
- normalized Listing domain model;
- idempotent listing upsert by `source + external_id`;
- price-history snapshots on price changes;
- core monitor filters;
- monitoring worker/service foundation;
- URL/SSRF input hardening;
- Docker Compose environment;
- CI with PostgreSQL integration tests.

No concrete marketplace adapter is enabled yet. Source-specific integrations are intentionally isolated behind the adapter contract.

## Local development

```bash
cp .env.example .env
docker compose up -d postgres redis
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload
```

API documentation is available at `http://localhost:8000/docs`.

Run checks:

```bash
ruff check .
mypy app
alembic upgrade head
pytest
```

See `AGENTS.md` for the required AI-development workflow and `docs/` for product and architecture requirements.
