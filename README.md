# Lootly

Lootly is a real-time marketplace monitoring and deal discovery service.

## Current development stage

The backend foundation now provides:

- FastAPI application;
- PostgreSQL persistence with SQLAlchemy 2.x;
- Alembic migrations;
- Redis;
- User and SearchMonitor APIs;
- marketplace adapter contract and registry;
- normalized Listing model;
- idempotent listing upsert by `source + external_id`;
- price-history snapshots;
- core monitor filters;
- Dramatiq Redis worker with async actor support;
- scheduler service driven by `next_check_at`;
- per-monitor Redis execution locks;
- URL/SSRF input hardening;
- Docker Compose for API, migrations, worker, scheduler, PostgreSQL and Redis;
- CI with PostgreSQL integration tests.

No concrete marketplace adapter is enabled yet. Source-specific integrations are intentionally isolated behind the adapter contract.

## Local development

```bash
cp .env.example .env
docker compose up
```

The compose stack applies migrations before starting API, worker and scheduler.

API documentation is available at `http://localhost:8000/docs`.

Run checks outside Docker:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
ruff check .
mypy app
pytest
```

See `AGENTS.md` for the required AI-development workflow and `docs/` for product and architecture requirements.
