# Skill: Deal Scoring

## Purpose

Оценивать выгодность объявления относительно сопоставимого рынка.

## MVP algorithm

1. Выбрать релевантную выборку объявлений.
2. Требовать минимальный размер выборки.
3. Использовать медиану, а не среднее, как базовую оценку рынка.
4. Рассчитать discount_pct.
5. Отдельно вычислить risk flags.
6. Не интерпретировать аномально низкую цену как автоматически хорошую сделку.

## Inputs

- listing price;
- normalized product/category attributes;
- region;
- recent comparable listings;
- condition when available.

## Outputs

- market_median;
- discount_pct;
- deal_score;
- risk_score or risk flags;
- sample_size;
- confidence.

## Rules

- money без float;
- insufficient sample должен давать unknown/low confidence;
- score должен быть объяснимым;
- сохранять факторы, повлиявшие на score;
- алгоритм должен быть детерминированным для одинаковых входов.

## Tests

- нормальная выборка;
- выброс;
- очень маленькая выборка;
- цена выше рынка;
- цена значительно ниже рынка;
- отрицательные/некорректные входные значения.
