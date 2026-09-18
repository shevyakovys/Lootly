# Skill: Booking Domain

## Purpose

Реализовывать бизнес-операции платформы онлайн-записи.

## Procedure

1. Определи organization/location scope.
2. Проверь существование клиента, сотрудника и услуги.
3. Проверь, что услуга назначена сотруднику.
4. Проверь статус сущностей.
5. Выполни domain validation.
6. Сохрани изменение атомарно.
7. Сохрани аудит значимого изменения, когда появится audit subsystem.
8. Добавь positive/negative tests.

## Appointment statuses

MVP:
- booked
- confirmed
- completed
- canceled
- no_show

Canceled/completed/no_show не должны рассматриваться как будущая занятость.

## Rules

- отмена не удаляет запись;
- цена записи фиксируется snapshot-значением на момент бронирования;
- длительность записи также фиксируется на момент бронирования;
- изменение Service после создания Appointment не должно менять прошлый визит.
