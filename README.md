# Lootly

Lootly — SaaS-платформа онлайн-бронирования для бизнеса в сфере услуг.

Текущая продуктовая концепция: онлайн-запись клиентов, сотрудники, услуги, филиалы, расписания, свободные слоты и журнал визитов.

## MVP foundation

- FastAPI;
- PostgreSQL + SQLAlchemy;
- Alembic;
- organizations / locations;
- staff / services;
- customers;
- working hours / time off;
- availability calculation;
- appointments with overlap protection;
- Docker Compose;
- GitHub Actions.

## Local development

```bash
cp .env.example .env
docker compose up -d postgres
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
alembic upgrade head
uvicorn app.main:app --reload
```

Docs:
- `docs/BUSINESS_REQUIREMENTS.md`
- `docs/TECHNICAL_REQUIREMENTS.md`
- `docs/ARCHITECTURE.md`
- `AGENTS.md`
