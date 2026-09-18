# Skill: Testing and Review

## Purpose

Проверять изменения перед merge.

## Review sequence

1. Сопоставить diff с требованиями.
2. Проверить границы модулей.
3. Проверить ошибки и edge cases.
4. Проверить безопасность.
5. Проверить idempotency.
6. Проверить наблюдаемость.
7. Проверить тесты.
8. Проверить миграции.
9. Проверить backward compatibility.
10. Проверить документацию.

## Minimum commands

Ожидаемые команды после появления codebase:
- ruff check .
- mypy app
- pytest
- alembic check или эквивалентная проверка миграций

## Review output

Для найденной проблемы фиксировать:
- severity;
- location;
- why it matters;
- recommended fix;
- whether it blocks merge.
