# Lootly

Lootly is a real-time marketplace monitoring and deal discovery service.

## Current development stage

The first backend foundation provides:

- FastAPI application;
- PostgreSQL persistence with SQLAlchemy 2.x;
- Alembic migrations;
- Redis in the local development stack;
- user creation/listing API;
- SearchMonitor CRUD API;
- basic URL/SSRF input hardening;
- Docker Compose environment;
- CI quality checks.

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
pytest
```

See `AGENTS.md` for the required AI-development workflow and `docs/` for product and architecture requirements.
