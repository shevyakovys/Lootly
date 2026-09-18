# Архитектура Lootly Booking Platform

## Context

```mermaid
flowchart LR
    C[Customer] --> WEB[Public Booking UI]
    A[Administrator] --> ADMIN[Admin UI]
    S[Staff] --> ADMIN

    WEB --> API[FastAPI]
    ADMIN --> API

    API --> BOOK[Booking Service]
    API --> AVAIL[Availability Service]
    API --> CRM[Customer Service]

    BOOK --> DB[(PostgreSQL)]
    AVAIL --> DB
    CRM --> DB

    BOOK --> OUTBOX[Notification Outbox]
    OUTBOX --> WORKER[Notification Worker]
    WORKER --> MSG[Email/SMS/Messenger]
```

## Domain boundaries

### Organization
Tenant root.

### Location
Физический/виртуальный филиал. Хранит timezone.

### Staff
Исполнитель услуги.

### Service
Название, duration, price, active flag.

### StaffService
Связь many-to-many, определяющая доступность услуги у сотрудника.

### WorkingHours
Регулярное расписание сотрудника по дню недели.

### TimeOff
Исключения: отпуск, перерыв, блокировка времени.

### Customer
Карточка клиента и история визитов.

### Appointment
Фактическая запись. Содержит snapshot duration/price.

## Booking sequence

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Availability
    participant DB

    Client->>API: GET available slots
    API->>Availability: calculate
    Availability->>DB: working hours + time off + appointments
    DB-->>Availability: schedule data
    Availability-->>Client: slots

    Client->>API: POST appointment
    API->>DB: begin transaction
    API->>DB: advisory lock staff/day
    API->>DB: re-check overlap
    alt slot free
        API->>DB: insert appointment
        API->>DB: commit
        API-->>Client: booked
    else occupied
        API->>DB: rollback
        API-->>Client: conflict
    end
```

## Time model

- Location.timezone: IANA identifier, e.g. Europe/Moscow.
- WorkingHours хранится как local wall-clock time + weekday.
- Appointment хранится в UTC.
- Availability сначала строится в local timezone, затем переводится в UTC.

## Scaling

Первый этап — modular monolith.

Масштабирование:
- несколько API replicas;
- PostgreSQL как consistency authority;
- Redis для кэша и фоновых задач;
- отдельные workers для уведомлений.

Не выделять микросервисы до измеренной необходимости.

## Future modules

- payment;
- loyalty;
- group sessions;
- resources/rooms;
- waitlist;
- analytics;
- integrations.
