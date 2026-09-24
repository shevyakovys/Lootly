# Lootly Product Improvement Specification

Status: IMPLEMENTED AND QA-CHECKED on 2026-09-24.

## Product goal
Lootly should behave as a coherent scheduling SaaS for service businesses: services can have a base duration, every employee can override that duration, availability is generated from the employee's effective duration, and the admin calendar, dashboard, public booking flow and widget must all reflect the same scheduling rules.

## Design direction
Use a restrained, production SaaS UI inspired by Tabler patterns: light neutral background, white surfaces, blue accent, compact but readable controls, consistent borders, predictable table/form layout, SVG icons, strong focus states and no decorative effects that reduce legibility.

## Phase 1 — Scheduling domain model
- Keep service base duration in minutes.
- Keep optional staff/service duration override.
- Effective duration = staff override when present, otherwise service duration.
- Availability start cadence follows effective duration for the selected employee.
- Calendar visual grid is independent from booking cadence.
- Booking creation, public booking, widget booking and rescheduling must validate full appointment duration against working hours, time off and overlapping appointments.
- Admin manual booking may use an exact local start time.

Acceptance:
- 30-minute employee: 09:00–09:30, 09:30–10:00...
- 60-minute employee: 09:00–10:00, 10:00–11:00...
- 80-minute employee: 09:00–10:20, 10:20–11:40...
- Two employees may have different durations for the same service.

## Phase 2 — Staff/service duration management
- Make individual duration management visible in the Staff catalog.
- Show assigned services and effective duration on every employee row.
- Add a clear "Services and time" action.
- Support base-duration mode and individual-duration mode.
- Add quick duration presets plus exact hours/minutes entry.
- Show a live effective-duration summary.
- Removing a service assignment removes that employee from booking for the service.

## Phase 3 — Dashboard / quick booking
- Quick booking must load only eligible employees.
- Employee option must show effective duration.
- Slot labels must show start and end.
- Exact-time mode remains available to managers.
- Upcoming appointments table must have separate Branch and Phone columns.
- Search must cover client, phone, branch, service and employee.
- Search icon must never overlap placeholder text.
- Disabled/loading/no-slot states must be visually explicit.

## Phase 4 — Calendar
- Calendar grid step affects display/drag snapping only.
- Appointment blocks retain their real duration.
- Drag/drop and modal reschedule validate the full appointment.
- Calendar text must not claim that the visual grid controls public booking cadence.
- Appointment modal shows duration, branch, employee, service and precise reschedule controls.

## Phase 5 — Public booking and widget
- Employee cards show effective service duration.
- Availability is based on that employee's effective duration.
- "Any employee" may aggregate availability from employees with different durations without creating invalid overlaps.
- Slots show start and end where useful.
- Empty states, retry states and occupied-slot conflicts are handled.
- Public booking and embedded widget use the same scheduling rules.

## Phase 6 — Catalog and settings clarity
- Service form supports exact duration up to 24 hours.
- Settings clearly distinguish calendar grid, booking horizon and minimum notice.
- Remove wording that implies a global 15-minute booking cadence.
- Add explanatory copy pointing to Staff → Services and time for individual durations.

## Phase 7 — Unified UI system
- Apply one Tabler-inspired component system across Dashboard, Catalog, Schedule, Calendar, Widgets, Settings, Auth and public booking.
- Use SVG icons only; no Unicode pseudo-icons.
- Normalize button, input, select, table, status, modal, tabs and empty states.
- Preserve responsive behavior and horizontal table scrolling where necessary.
- Maintain visible keyboard focus.

## Phase 8 — Reliability and error handling
- Protect against duplicate/occupied bookings server-side.
- Keep loading controls disabled while requests run.
- Retry recoverable public availability failures.
- Do not lose contact data when moving backward in booking flow.
- Preserve clear user-facing error messages for working-hours, time-off and collision failures.

## Phase 9 — QA and release checks
- app.js and embed.js must parse successfully.
- CSS block balance must be valid.
- Availability RPCs must use effective staff duration and must not use the legacy global booking interval as slot cadence.
- Cache-bust assets after material UI/logic changes.
- Run Supabase security advisors after schema/function migrations.
- Verify representative 30/60/80-minute duration calculations in the database.

## Completion criteria
Implementation is complete when all phases above are represented in code/database, static QA checks pass, the duration engine is verified in Supabase, and the production GitHub Pages assets are cache-busted.


## Implementation result

All phases in this specification are implemented in the current `main` branch.

### Scheduling engine
- Availability cadence now uses effective staff/service duration.
- The legacy organization booking interval is not used by admin/public/widget availability generation.
- Admin quick booking uses an authenticated staff/service RPC and does not consume the public rate limit.
- "Any employee" availability is deterministic when several employees can start at the same time.
- Server-side booking/rescheduling still validates full duration, working hours, time off and overlap constraints.

### Staff duration management
- The Staff catalog shows assigned services and their effective durations.
- "Services and time" opens the employee-specific configuration.
- Base duration and individual override modes are supported.
- Exact hours/minutes entry and 30/45/60/80/90-minute presets are available.

### Dashboard and public booking
- Quick booking shows employee-specific duration and start/end for each slot.
- Upcoming appointments contain separate Branch and Phone columns.
- Search covers client, phone, branch, service and employee.
- Search icon placement is fixed without pseudo-element overlap.
- Public employee cards and slots show effective duration/start/end information.

### Calendar and settings
- Calendar grid is a local visual preference only.
- Online booking cadence is not exposed as a global 15-minute setting.
- Settings retain booking horizon and minimum notice.
- Calendar drag/reschedule remains duration-aware and server-validated.

### UI and release
- A unified Tabler-inspired component layer is applied across admin, public booking and embed shell.
- SVG icons replace interactive Unicode pseudo-icons.
- Responsive table scrolling, focus styles and success/empty states are included.
- Final assets are cache-busted in `site/index.html`.

## QA evidence

- `site/app.js`: syntax parse passed.
- `site/embed.js`: syntax parse passed.
- `site/styles.css`: brace balance = 0.
- Availability RPC audit:
  - `get_admin_availability`: effective-duration cadence = yes; legacy interval cadence = no.
  - `get_public_availability`: effective-duration cadence = yes; legacy interval cadence = no.
  - `get_public_widget_availability`: effective-duration cadence = yes; legacy interval cadence = no.
- Representative cadence calculation verified in PostgreSQL:
  - 30 min: 09:00–09:30, 09:30–10:00...
  - 60 min: 09:00–10:00, 10:00–11:00...
  - 80 min: 09:00–10:20, 10:20–11:40, 11:40–13:00.
- Current production test data for a 60-minute employee returned hourly public availability.
- Supabase security advisors were run after migrations. Public booking SECURITY DEFINER warnings remain intentional because those RPCs are the externally exposed booking API and contain validation/rate limiting; manager RPCs validate authenticated organization/role internally.
