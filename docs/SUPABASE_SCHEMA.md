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
- `notification_outbox`
- `public_booking_events`
- `public_rate_limit_events`
- `user_invites`

All organization/customer/appointment data is stored in PostgreSQL.

## Booking consistency

Active appointment overlap is prevented by a PostgreSQL exclusion constraint over:

```text
staff_id = same staff
AND
tstzrange(start_at, end_at, '[)') overlaps
AND
status IN ('booked', 'confirmed')
```

This is the final consistency barrier and remains effective under concurrent requests.

## Public RPC

Public clients may call only:

- `get_public_catalog`
- `get_public_staff`
- `get_public_availability`
- `track_public_booking_view`
- `create_public_booking`

These functions validate organization/location/service/staff relationships and enforce rate limits.

## Authenticated RPC

Authenticated users may call:

- `create_admin_booking`
- `reschedule_appointment`
- `set_appointment_status`
- `get_admin_analytics`

Authorization derives from the authenticated user's `profiles` record.
