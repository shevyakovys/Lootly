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


## Free hosted production profile

The current zero-cost production runtime uses Supabase rather than a continuously running FastAPI
container:

- Supabase PostgreSQL;
- Supabase Auth;
- RLS for tenant isolation;
- PostgreSQL RPC for booking invariants and availability;
- Supabase Edge Function for the static/hash-routed web UI.

The self-hosted Python/FastAPI implementation remains supported as a reference deployment, while
Supabase is the active public deployment.


## Embeddable booking widget

Active zero-cost production exposes an embeddable widget through GitHub Pages and Supabase RPC.

- `booking_widgets` stores tenant-scoped widget configuration and a non-secret public UUID key.
- Widget configuration is editable only by owner/admin under RLS.
- Public RPC returns only safe presentation/configuration fields.
- Location/service/staff restrictions are revalidated in public RPC and booking creation.
- Availability for "any staff" is constrained by the widget's staff scope.
- `site/embed.js` creates the floating launcher and drawer/modal iframe.
- The iframe runtime is `#/widget/{public_key}`.
- The Supabase publishable key may be present in browser code; service-role secrets must never be exposed.


## Frontend structure and UX runtime

The zero-cost hosted frontend is intentionally dependency-light:

- `site/index.html` — static application shell;
- `site/styles.css` — shared responsive design system;
- `site/app.js` — authenticated admin and public booking SPA;
- `site/embed.js` — external website widget launcher.

The UI must preserve all existing domain workflows when redesigned. Service assignment, team invites,
working-hours management, tenant scoping and booking constraints remain functional requirements, not
optional presentation details.

Widget analytics are stored in `booking_widget_events`. Public tracking is idempotent per
widget/session/event and exposed through rate-limited RPC.


## Calendar and customer UX

`reschedule_appointment_local` receives local date/time and resolves it using the appointment
location IANA timezone before delegating to the existing reschedule invariant checks. Browser timezone
must not decide the stored appointment time.

## Service catalog extensions

- `service_categories` is organization-scoped and RLS protected.
- `services.category_id` is optional.
- `staff_members.avatar_url` is optional presentation data.

## Waitlist

`waitlist_entries` is tenant scoped. Anonymous users cannot write the table directly.
Widget waitlist creation is available only through `create_public_widget_waitlist`, which revalidates:
- active widget;
- widget waitlist setting;
- widget location/service/staff scope;
- active location/service/staff relationships;
- basic contact/date input;
- public rate limit.

## Embed reliability

`site/embed.js`:
- runs inside Shadow DOM when supported;
- has request timeout and bounded retries for safe reads;
- falls back to a direct booking launcher if config loading fails;
- tolerates unavailable sessionStorage;
- communicates iframe lifecycle via `postMessage`;
- emits browser `CustomEvent` events:
  - `lootly:ready`
  - `lootly:booking`
  - `lootly:error`.

Booking creation is not automatically retried because a lost response could otherwise create
ambiguous client behavior. A conflict returns the customer to refreshed availability.
