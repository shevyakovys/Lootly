# Supabase Free Production Deployment

## Live deployment

Lootly is currently deployed on Supabase Free.

- Project ref: `tccmnfuwambjbsbmozdl`
- Public web URL: `https://tccmnfuwambjbsbmozdl.supabase.co/functions/v1/web`
- Supabase URL: `https://tccmnfuwambjbsbmozdl.supabase.co`

## Production topology

```text
Browser
  |
  v
Supabase Edge Function: web
  |
  +--> Supabase Auth
  |
  +--> PostgREST RPC / RLS
          |
          v
      PostgreSQL
```

There is no separately hosted FastAPI server in the free production deployment.

## Security model

- Browser uses only the Supabase publishable key.
- The publishable key is not a secret.
- Organization-owned tables have RLS enabled.
- Public browsing/booking is exposed only through narrow PostgreSQL RPC functions.
- Public booking RPCs enforce rate limiting.
- Appointment overlap is protected in PostgreSQL by a GiST exclusion constraint.
- Owner/admin/staff access is resolved from `profiles`, not editable user metadata.
- The auth trigger creates the first owner/organization from sign-up metadata.
- Team members join through one-time invite tokens.

## Public booking

After an owner creates an organization with slug `my-studio`, the public booking route is:

```text
https://tccmnfuwambjbsbmozdl.supabase.co/functions/v1/web#/book/my-studio
```

## Current Supabase migrations

The production project contains these logical migration stages:

1. initial booking schema + RLS;
2. public booking functions and security hardening;
3. public RPC rate limiting;
4. auth onboarding + invite flow;
5. authenticated admin booking RPCs;
6. public RPC volatility/auth-trigger hardening.

The deployed database is the current source of truth for these migrations.

## Notifications

The MVP persists confirmation/reminder/cancellation events in `notification_outbox`.
External SMS/email delivery still requires an external provider credential/webhook and is not enabled
on the free deployment.
