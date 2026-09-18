# Skill: Marketplace Monitoring

## Purpose

Реализация мониторинга объявлений через абстракцию источников.

## Use when

- добавляется новый marketplace adapter;
- меняется polling;
- добавляется фильтрация;
- реализуется дедупликация.

## Procedure

1. Определи capabilities источника.
2. Реализуй adapter interface.
3. Нормализуй listing в доменную модель.
4. Добавь timeout и retries.
5. Добавь rate limiting.
6. Обеспечь idempotent upsert по source + external_id.
7. Не отправляй уведомление до завершения фильтрации.
8. Добавь contract tests.
9. Добавь fixture с реалистичным payload без персональных данных.
10. Проверь, что domain слой не импортирует source-specific код.

## Acceptance checklist

- adapter изолирован;
- ошибки классифицируются;
- дубли не создаются;
- повторный fetch безопасен;
- есть тесты на пустой ответ;
- есть тесты на malformed payload;
- есть тесты на duplicate listing.
