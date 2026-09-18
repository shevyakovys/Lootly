# Skill: Testing & Review

## QA sequence

1. Сопоставить diff с требованиями.
2. Проверить booking invariants.
3. Проверить time zone handling.
4. Проверить race conditions и двойное бронирование.
5. Проверить деньги и snapshots.
6. Проверить authorization/tenant boundaries.
7. Проверить миграции.
8. Проверить негативные сценарии.
9. Запустить:
   - ruff check .
   - mypy app
   - alembic upgrade head
   - pytest
10. Blocking defects: critical/high и любой падающий обязательный gate.

## Review report

Для дефекта:
- severity;
- location;
- evidence;
- impact;
- recommended fix;
- blocks merge.
