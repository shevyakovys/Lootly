# MVP Implementation Status

Дата ревизии: 2026-09-19.

## Реализовано

- multi-tenant organizations;
- owner/admin/staff authentication and RBAC;
- locations, staff, services, customers;
- staff-service assignments;
- working hours and time off;
- timezone-aware availability;
- PostgreSQL advisory-lock double-booking protection;
- admin appointment journal;
- reschedule/cancel/status lifecycle;
- customer visit history;
- public booking by organization slug;
- "any available staff" flow;
- public booking session tracking;
- public rate limiting;
- notification outbox;
- booking confirmations;
- reschedule/cancellation notifications;
- scheduled reminders;
- webhook notification delivery adapter;
- analytics: bookings, online conversion, cancellations, no-shows, lead time,
  repeat customers, staff utilization, notification delivery;
- Next.js admin dashboard;
- Next.js public booking UI;
- Docker Compose deployment;
- backend and frontend CI.

## Внешняя доставка уведомлений

По умолчанию worker использует local delivery adapter. Для реальной SMS/email/messenger
доставки задается `LOOTLY_NOTIFICATION_WEBHOOK_URL`. Это единственная внешняя интеграция
MVP, для которой production-поставщик выбирается оператором развертывания.

## За пределами MVP

- payments/prepayment;
- waitlist;
- rooms/resources;
- recurring appointments;
- group sessions;
- loyalty/subscriptions/certificates;
- payroll/inventory/accounting;
- mobile applications.
