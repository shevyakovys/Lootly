# Supabase Production Schema

## Core tables

- `organizations`
- `profiles`
- `locations`
- `staff_members`
- `services`
- `staff_services`
- `customers`
- `working_hours`
- `time_off`
- `appointments`
- `booking_widgets`
- `waitlist_entries`
- `notification_outbox`
- `public_booking_events`
- `public_rate_limit_events`
- `user_invites`

All organization/customer/appointment data is stored in PostgreSQL.

## Duration model

`services.duration_minutes` is the default duration of a service.

`staff_services.duration_override_minutes` is optional. The effective duration used by booking logic is:

```text
coalesce(staff_services.duration_override_minutes, services.duration_minutes)
```

This allows the same service to take, for example, 30 minutes for one employee and 60 or 80 minutes for another.

Availability generation uses the effective employee/service duration both as the appointment length and as the cadence between offered starts. The legacy `organizations.booking_interval_minutes` value is retained for backwards-compatible settings/RPC signatures and must not be used as public/admin availability cadence.

The calendar display grid is a UI preference and is independent from availability cadence.

## Booking consistency

Active appointment overlap is prevented by a PostgreSQL exclusion constraint over:

```text
staff_id = same staff
AND
tstzrange(start_at, end_at, '[)') overlaps
AND
status IN ('booked', 'confirmed')
```

Booking and rescheduling RPCs also validate that the full effective duration fits within working hours and does not overlap `time_off`.

This is the final consistency barrier and remains effective under concurrent requests.

## Public RPC

Anonymous booking flows use:

- `get_public_catalog`
- `get_public_staff`
- `get_public_availability`
- `track_public_booking_view`
- `create_public_booking`
- `get_public_widget`
- `get_public_widget_staff`
- `get_public_widget_availability`
- `create_public_widget_booking`
- `create_public_widget_waitlist`
- `track_widget_event`

Public functions validate organization/location/service/staff/widget relationships and apply public rate limiting where appropriate.

## Authenticated RPC

Manager/admin flows use:

- `get_admin_staff_for_service`
- `get_admin_availability`
- `create_admin_booking`
- `create_admin_booking_local`
- `reschedule_appointment`
- `reschedule_appointment_local`
- `set_appointment_status`
- `get_admin_analytics`
- `get_widget_analytics`
- `set_booking_policy`
- `create_time_off_local`

Authorization derives from the authenticated user's `profiles` record. Manager-only functions validate the organization and role internally.

## Availability examples

For a continuous working interval beginning at 09:00:

- effective duration 30 minutes: 09:00–09:30, 09:30–10:00, 10:00–10:30...
- effective duration 60 minutes: 09:00–10:00, 10:00–11:00...
- effective duration 80 minutes: 09:00–10:20, 10:20–11:40, 11:40–13:00...

Candidates that intersect appointments or time off are removed before returning availability.
