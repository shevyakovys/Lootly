# Skill: Availability & Scheduling

## Purpose

Рассчитывать свободные слоты и безопасно создавать запись.

## Inputs

- location timezone;
- staff working hours;
- time off;
- service duration;
- existing active appointments;
- requested date/range;
- service/staff eligibility.

## Algorithm baseline

1. Построить рабочие интервалы сотрудника в timezone филиала.
2. Преобразовать границы в UTC.
3. Вычесть time off.
4. Вычесть активные appointments.
5. Нарезать остаток на candidate slots по configured slot step.
6. Оставить интервалы, где полностью помещается service duration.

## Concurrency

Availability endpoint носит информативный характер.
Истина — транзакция создания Appointment.

При создании:
- взять transaction-level advisory lock для staff/day или эквивалент;
- повторно проверить overlap;
- только затем вставить Appointment;
- commit.

## Tests

Обязательно:
- начало/конец рабочего дня;
- соседние записи без overlap;
- overlap в начале/конце/внутри;
- canceled appointment;
- time off;
- разные service duration;
- timezone conversion;
- DST boundary для timezone, где DST существует;
- конкурентное создание одного слота.
