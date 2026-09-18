# Agent and Skill Routing

Полные правила находятся в корневом `AGENTS.md`.

## Agents

### Development Agent
Используй `.agents/lootly-agent.md` для проектирования и реализации любой инженерной задачи.

### QA Agent
Используй `.agents/qa-agent.md` после каждого существенного изменения кода, схемы БД, инфраструктуры или публичного API.

QA Agent выполняется как отдельная стадия после Development Agent и может вернуть задачу на исправление.

## Marketplace monitoring

Используй `.agents/skills/marketplace-monitoring/SKILL.md`, если задача содержит:
- marketplace/source adapter;
- получение объявлений;
- polling/scheduler;
- очереди проверок;
- нормализацию listing;
- фильтры;
- дедупликацию;
- source rate limits;
- обработку ошибок источника.

## Deal scoring

Используй `.agents/skills/deal-scoring/SKILL.md`, если задача содержит:
- market price;
- price history;
- comparable listings;
- median;
- discount;
- Deal Score;
- Risk Score;
- confidence.

## Testing and review

QA Agent обязан использовать `.agents/skills/testing-and-review/SKILL.md`.

## Multiple skills

Skills не взаимоисключающие. Любая кодовая задача завершается QA Agent + testing-and-review независимо от остальных skills.
