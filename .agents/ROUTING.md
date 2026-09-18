# Skill Routing

Этот файл — краткая карта выбора skills. Полные правила загрузки находятся в корневом `AGENTS.md`.

## Marketplace monitoring

Используй `.agents/skills/marketplace-monitoring/SKILL.md`, если задача содержит хотя бы один из аспектов:

- marketplace/source adapter;
- получение объявлений;
- polling;
- scheduler;
- очереди проверок;
- нормализация listing;
- фильтры;
- дедупликация;
- source rate limits;
- обработка ошибок источника.

## Deal scoring

Используй `.agents/skills/deal-scoring/SKILL.md`, если задача содержит:

- market price;
- price history;
- comparable listings;
- median;
- discount;
- Deal Score;
- Risk Score;
- confidence;
- оценку выгодности.

## Testing and review

Используй `.agents/skills/testing-and-review/SKILL.md` перед завершением ЛЮБОЙ задачи, которая меняет код, схему БД, инфраструктуру или публичный API.

## Multiple skills

Skills не взаимоисключающие.

Если задача пересекает области, загружай их вместе. Например:

- новый adapter + Deal Score → marketplace-monitoring + deal-scoring + testing-and-review;
- изменение scheduler → marketplace-monitoring + testing-and-review;
- новый pricing endpoint → deal-scoring + testing-and-review.
