# NCL Sales Trainer = NeuroCloser

**NeuroCloser** — AI-тренажёр дожатия B2B-сделок для менеджеров дистрибьютора электронных компонентов.

Менеджер ведёт переговоры с AI-клиентом (закупщик / главный инженер / снабженец завода или КБ в РФ), учится выявлять производственную боль, давать экспертную презентацию цепочки поставок и закрывать на следующий шаг: **BOM**, встреча с инженером, **NDA**, опытная партия.

Стек: **FastAPI · PostgreSQL · Redis · Next.js 14 · Nginx**. Все LLM — только [NeuralDEEP](https://neuraldeep.ru/) PRO (`https://api.neuraldeep.ru/v1`). GPT/OpenAI отключены.

---

## Роли

| Роль | Кому | Что доступно |
| --- | --- | --- |
| **Менеджер** | Сейлзы заказчика | Тренировки, Terra, радар, Sol, личный дашборд |
| **РОП** (`admin`) | Руководитель отдела продаж | Команда менеджеров, аналитика, отчёты CSV |
| **Разработчик** (`developer`) | Владелец продукта / вы | Баланс проекта, AI-настройки, тарифы ₽, промпты, KB, все пользователи |

Баланс проекта единый на инстанс. Списания за карточку клиента, реплики диалога, Terra, радар и Sol. Пополнение вручную в `/dev/billing` (ЮKassa — следующий этап).

---

## Возможности

| Для менеджера | Для РОПа | Для разработчика |
| --- | --- | --- |
| Тренировки с AI-клиентом | Аналитика команды + график | Баланс и ledger |
| Подсказки **Terra** | CRUD менеджеров | Модели и тарифы ₽ |
| Голос → текст | Отчёт CSV руководству | Промпты (версии) |
| **Радар 6 компетенций** | Разбор чужих сессий | База знаний |
| Разбор **Sol** | | Пользователи любых ролей |

---

## Запуск

Только Docker:

```bash
cp .env.example .env
# задайте LLM_API_KEY=sk-... из кабинета NeuralDEEP
docker compose up --build
```

UI: **http://localhost:8080**

---

## Seed-аккаунты

| Роль | Email | Пароль |
| --- | --- | --- |
| Разработчик | `dev@ncl.local` | `ChangeMe_Dev_123` (или `SEED_DEVELOPER_PASSWORD`) |
| РОП | `admin@ncl.local` | `ChangeMe_Admin_123` (или `SEED_ADMIN_PASSWORD`) |
| Менеджер | `manager1@ncl.local` … `manager3@ncl.local` | `ChangeMe_Manager_123` (или `SEED_MANAGER_PASSWORD`) |

Seed также создаёт баланс проекта (`SEED_BILLING_BALANCE_RUB`, по умолчанию 5000 ₽).

---

## NeuralDEEP — модели (по умолчанию)

| Задача | Ключ настройки | Модель |
| --- | --- | --- |
| Диалог AI-клиента | `client_model_id` | `qwen3.6-fp8-noreason` |
| Карточка клиента | `card_model_id` | `qwen3.6-fp8-noreason` |
| Terra (подсказки) | `hint_model_id` | `qwen3.6-fp8-noreason` |
| Радар реплики | `radar_model_id` | `qwen3.6-fp8-noreason` |
| Sol (разбор) | `analyst_model_id` | `qwen3.8-27b-noreason` |

Модели и тарифы: `/dev/settings`. Промпты: `/dev/prompts`.

---

## API (кратко)

**Auth:** `POST /api/v1/auth/login|refresh|logout`, `GET /api/v1/auth/me`

**Тренировки:** `GET/POST /trainings`, messages, hints, analyze-message, complete, analysis, speech

**РОП:** `/api/v1/rop/stats/team|series`, `/rop/stats/managers/{id}`, `/rop/trainings`, `/rop/reports/summary.csv`, `/rop/users`

**Разработчик:** `/api/v1/dev/billing`, `/dev/billing/topup`, `/dev/billing/ledger`, `/dev/settings`, `/dev/prompts`, `/dev/knowledge`, `/dev/users`

---

## Этапы

1–5.5 — инфра, диалог, Sol, радар  
6 — аналитика РОПа (команда, динамика, CSV) — **готово**  
7 — админка разработчика (AI, промпты, KB, баланс MVP) — **готово**  
Далее — ЮKassa (онлайн-пополнение баланса)

Презентация для заказчика: [PRESENTATION.md](PRESENTATION.md)  
Репозиторий: https://github.com/ashabalin336777-ai/NCL
