# Бизнес-требования Lootly — Online Booking Platform

## 1. Видение

Lootly — SaaS для бизнеса в сфере услуг, аналог по классу задач YCLIENTS: онлайн-запись клиентов, расписание сотрудников, журнал визитов, клиентская база и автоматизация коммуникаций.

Цель — дать малому и среднему сервисному бизнесу единое место для управления загрузкой и записью клиентов.

## 2. Целевые сегменты

- салоны красоты и барбершопы;
- студии массажа и SPA;
- частные специалисты;
- фитнес/йога/студии;
- образовательные и консультационные услуги;
- бытовые услуги;
- сервисные центры.

## 3. Роли

### Owner
Управляет организацией, филиалами, сотрудниками, услугами, доступами и аналитикой.

### Administrator
Работает с журналом записи, клиентами, переносами и отменами.

### Staff
Видит свое расписание и записи.

### Customer
Самостоятельно выбирает услугу, сотрудника, дату/время и создает запись.

## 4. MVP

### Справочники
- организация;
- филиалы;
- сотрудники;
- услуги;
- назначение услуг сотрудникам;
- клиенты.

### Расписание
- регулярные рабочие часы сотрудника;
- исключения/time off;
- расчет свободных слотов;
- длительность услуги;
- timezone филиала.

### Записи
- создание записи администратором;
- публичное создание записи клиентом;
- просмотр;
- перенос;
- отмена;
- статусы booked/confirmed/completed/canceled/no_show;
- защита от двойного бронирования.

### Клиентская база
- имя;
- телефон;
- email;
- заметка;
- история визитов.

### Уведомления
После базового booking flow:
- подтверждение записи;
- напоминание;
- уведомление об отмене/переносе.

## 5. Публичный online booking flow

1. клиент открывает страницу организации/филиала;
2. выбирает услугу;
3. выбирает сотрудника или «любой доступный»;
4. выбирает дату и свободный слот;
5. вводит контакты;
6. подтверждает запись;
7. получает подтверждение.

## 6. Бизнес-инварианты

- слот не может быть забронирован дважды;
- сотрудник оказывает только назначенные ему услуги;
- запись создается только в доступное время;
- отмененная запись освобождает слот;
- прошлые записи сохраняют цену и длительность услуги на момент бронирования;
- данные разных организаций изолированы.

## 7. Метрики MVP

- bookings_created;
- online_booking_conversion;
- cancellation_rate;
- no_show_rate;
- staff_utilization;
- booking_lead_time;
- repeat_customer_rate;
- notification_delivery_rate.

## 8. Не входит в первый MVP

- склад;
- зарплаты;
- полноценный финансовый учет;
- программа лояльности;
- абонементы/сертификаты;
- групповые занятия;
- сложные цепочки услуг;
- marketplace интеграций;
- мобильные приложения.

## 9. Следующие этапы

V2:
- платежи/предоплата;
- waitlist;
- ресурсы/кабинеты;
- recurring appointments.

V3:
- групповые занятия;
- loyalty;
- advanced analytics;
- fine-grained permissions;
- multi-location reporting.

V4:
- интеграции с картами, мессенджерами, телефонией и внешними CRM.


## 10. Конструктор виджетов онлайн-записи

Организация может создавать несколько независимых виджетов онлайн-записи для разных сайтов,
лендингов, рекламных кампаний и филиалов.

Настройки виджета:
- собственное имя в кабинете;
- active/inactive;
- заголовок и подзаголовок;
- основной HEX-цвет;
- текст и позиция плавающей кнопки;
- открытие как drawer или modal;
- сторона drawer;
- анимация кнопки;
- включение/скрытие шага выбора специалиста;
- разрешение варианта «любой доступный специалист»;
- порядок первых шагов: филиал или услуга;
- ограничения по филиалам, услугам и сотрудникам;
- брендирование Lootly;
- live preview;
- standalone URL;
- готовый embed code для установки на внешний сайт.

Публичный runtime виджета обязан применять ограничения виджета на серверной стороне, а не только
скрывать варианты в интерфейсе.


## 11. UI/UX quality requirements

Lootly should feel like a professional SaaS product rather than a collection of CRUD forms.

Admin experience:
- persistent desktop navigation and compact mobile navigation;
- today's operational overview;
- onboarding checklist for incomplete setup;
- quick actions for frequent workflows;
- searchable/filterable appointment journal;
- human-readable customer/service/staff context in appointments;
- consistent empty, loading, success and error states;
- responsive behavior for phone, tablet and desktop.

Customer booking experience:
- guided multi-step flow;
- visible progress;
- touch-friendly service/location/staff choices;
- seven-day date strip and slot grid;
- clear booking summary before confirmation;
- mobile-first layout;
- success screen after booking.

Widget distribution:
- floating launcher embed;
- inline iframe embed;
- direct booking link;
- conversion analytics for view/open/booking events.


## 12. Calendar, customer profile and waitlist

### Calendar
- day and week modes;
- location/staff filters;
- appointment cards with customer/service/staff context;
- owner/admin may move active appointments by drag-and-drop;
- drag-and-drop rescheduling is interpreted in the appointment location timezone;
- booking availability and overlap rules remain authoritative.

### Customer profile
- contacts;
- internal note;
- total visit count;
- completed-visit spend;
- next active visit;
- visit history.

### Service catalog
- optional categories;
- category-aware online booking display;
- optional staff image URL.

### Waitlist
When a widget has waitlist enabled and no slots are available, a customer may leave:
- name;
- phone;
- optional email;
- desired date;
- optional staff preference.

The dashboard exposes waiting entries to managers. Managers can mark entries contacted or canceled.

### Widget resilience
The widget must:
- retry safe read operations after transient network failures;
- time out stalled requests;
- never retry booking creation blindly;
- translate infrastructure errors to customer-facing messages;
- refresh availability after a concurrent slot conflict;
- show setup errors separately from temporary network errors;
- isolate embed styles from host-page CSS;
- emit integration events to the host page.
