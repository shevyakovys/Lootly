# Технические требования Lootly Booking Platform

## Stack

Backend:
- Python 3.12+
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic

Storage:
- PostgreSQL

Background processing:
- PostgreSQL notification outbox
- dedicated notification worker
- optional webhook delivery adapter

Frontend:
- Next.js 16
- React 19
- TypeScript

Infrastructure:
- Docker
- Docker Compose
- GitHub Actions

## Core modules

- organizations
- locations
- staff
- services
- customers
- schedules
- availability
- appointments
- notifications
- auth

## Persistence rules

- UUID primary keys;
- timestamps timezone-aware;
- UTC in DB;
- IANA timezone on Location;
- monetary values Numeric/Decimal;
- appointment snapshots for price and duration;
- soft/domain cancellation instead of deletion of visits.

## Availability

Availability calculation must consider:
- working hours by weekday;
- time off exceptions;
- existing non-canceled appointments;
- service duration;
- service/staff relation;
- location timezone.

Default slot step for MVP: 15 minutes.

## Double-booking protection

Availability response alone is not sufficient.

Appointment creation must:
1. start transaction;
2. acquire deterministic PostgreSQL advisory lock for staff + local service date;
3. reload conflicts;
4. reject overlap;
5. insert appointment;
6. commit.

## API requirements

Version prefix: `/api/v1`.

MVP endpoints:
- organizations;
- locations;
- staff;
- services;
- customers;
- working-hours;
- time-off;
- availability;
- appointments.

## Performance goals

- CRUD API p95 < 500 ms;
- availability p95 < 750 ms for one staff/day;
- booking creation p95 < 750 ms excluding external notifications;
- no duplicate active appointments for same staff/time under concurrency.

## Security

- tenant isolation on every organization-owned entity;
- authentication before admin API;
- public booking endpoints expose only necessary fields;
- per-process rate limiting public booking in MVP; use a shared limiter (Redis/gateway) when scaling to multiple API replicas;
- phone/email treated as personal data;
- structured logs without unnecessary PII;
- secrets via environment/secrets manager.

## Testing

- domain unit tests;
- integration tests with PostgreSQL;
- overlap/concurrency tests;
- timezone/DST tests;
- migration smoke tests;
- API tests.

## CI

Required:
- ruff;
- mypy;
- alembic upgrade head;
- pytest;
- frontend ESLint;
- frontend production build.
