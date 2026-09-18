# Технические требования Lootly

## 1. Общие требования

Система должна быть модульной, наблюдаемой и пригодной к горизонтальному масштабированию. Архитектура не должна быть жестко связана с одним источником объявлений.

## 2. Рекомендуемый стек

Backend:
- Python 3.12+
- FastAPI
- Pydantic
- SQLAlchemy 2.x
- Alembic

Хранилища и очереди:
- PostgreSQL
- Redis

Фоновые задачи:
- Celery, Dramatiq или ARQ

Frontend:
- Next.js
- TypeScript
- Tailwind CSS

Инфраструктура:
- Docker
- Docker Compose для локальной разработки
- Nginx или managed ingress в production
- CI/CD через GitHub Actions

## 3. Основные сервисы

### API Service
Отвечает за:
- пользователей;
- мониторинги;
- настройки;
- списки объявлений;
- статистику;
- административные операции.

### Scheduler
Планирует проверки активных мониторингов.

### Worker
Получает задания, обращается к источникам, нормализует данные, выполняет фильтры, рассчитывает оценку и создает события уведомлений.

### Notification Service
Отправляет сообщения в Telegram и в будущем другие каналы.

### Pricing Service
Вычисляет типичную цену, скидку к рынку и дополнительные аналитические показатели.

## 4. Модель данных

Минимальные сущности:
- User
- SearchMonitor
- DataSource
- Listing
- ListingSnapshot
- Notification
- PriceStatistic
- AuditEvent

### SearchMonitor
Поля:
- id
- user_id
- source
- name
- query_url
- min_price
- max_price
- include_keywords
- exclude_keywords
- region
- interval_seconds
- min_deal_score
- enabled
- created_at
- updated_at

### Listing
Поля:
- id
- source
- external_id
- title
- description
- price
- currency
- url
- location
- seller_name
- published_at
- first_seen_at
- last_seen_at
- raw_payload

Уникальный ключ должен включать source + external_id.

## 5. Функциональные требования

Система должна:
- выполнять проверки по расписанию;
- предотвращать одновременный запуск одной и той же проверки;
- иметь идемпотентную обработку объявления;
- поддерживать повторные попытки при временных ошибках;
- ограничивать частоту запросов к внешним источникам;
- сохранять исходные данные в диагностических целях;
- логировать ошибки интеграций;
- не отправлять одно и то же уведомление повторно без явной причины.

## 6. Производительность

Для MVP:
- API p95 < 500 мс для обычных CRUD-запросов;
- постановка фоновой задачи < 1 секунды;
- обработка нового объявления без внешней задержки < 3 секунд;
- поддержка не менее 1 000 активных мониторингов на одной небольшой production-конфигурации при разумном интервале опроса.

## 7. Надежность

Требуется:
- retries с exponential backoff;
- dead-letter подход или отдельная очередь ошибок;
- health checks;
- readiness/liveness endpoints;
- централизованные логи;
- метрики worker throughput, error rate, notification latency;
- защита от повторной обработки одного события.

## 8. Безопасность

Обязательно:
- секреты только через environment/secrets manager;
- пароли только как стойкие хэши;
- JWT или защищенные server-side sessions;
- rate limiting API;
- валидация входных URL;
- запрет SSRF;
- минимальные права сервисных учетных записей;
- отсутствие секретов в логах;
- аудит критичных действий.

## 9. Тестирование

Минимальный набор:
- unit tests для фильтров и deal score;
- integration tests для БД;
- contract tests для adapters источников;
- tests для дедупликации;
- tests для Telegram formatter;
- API tests;
- smoke test Docker Compose окружения.

## 10. CI/CD

Pipeline должен выполнять:
- lint;
- type checks;
- tests;
- security checks зависимостей;
- сборку Docker image;
- публикацию image только после успешных тестов.

## 11. Совместимость источников

Интеграция с каждым источником реализуется через adapter interface. Бизнес-логика не должна напрямую зависеть от HTML, endpoint-структуры или формата конкретной площадки.
