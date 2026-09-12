# NCL Sales Trainer = NeuroCloser

**NeuroCloser** — тренажёр дожатия сделок с ИИ (AI-тренер для менеджеров B2B-продаж электронных компонентов).

Продукт учит менеджера дистрибьютора выявлять производственную боль завода/КБ, давать экспертную презентацию цепочки поставок и закрывать на следующий шаг (BOM, встреча с инженером, NDA), а не «скинуть КП».

Стек: FastAPI, PostgreSQL, Redis, Next.js, Nginx. Все LLM — только [NeuralDEEP](https://neuraldeep.ru/) PRO (`https://api.neuraldeep.ru/v1`). Модели GPT/OpenAI отключены.

## Запуск

Только через Docker:

```bash
cp .env.example .env
docker compose up --build
```

## Frontend

- UI: http://localhost:8080
- Логин: `/login`
- После входа: `/dashboard`, `/trainings`, админка `/admin/*` (РОП)

Стек UI: Next.js App Router, Tailwind, shadcn-подобные компоненты, TanStack Query, Zustand.
JWT хранится в cookies; `middleware.ts` защищает приватные маршруты.

## Seed-аккаунты

| Роль | Email | Пароль (из `.env`) |
| --- | --- | --- |
| РОП | `admin@ncl.local` | `SEED_ADMIN_PASSWORD` |
| Менеджер | `manager1@ncl.local` | `SEED_MANAGER_PASSWORD` |
| Менеджер | `manager2@ncl.local` | `SEED_MANAGER_PASSWORD` |
| Менеджер | `manager3@ncl.local` | `SEED_MANAGER_PASSWORD` |

## Auth API

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## NeuralDEEP PRO — маршрутизация моделей

Все выбранные модели входят в подписку Pro и обрабатываются **в РФ** (152-ФЗ). Premium PAYG (DeepSeek, GLM, MiniMax) не используем.

| Задача | Модель | Почему |
| --- | --- | --- |
| AI-клиент (диалог) | `qwen3.8-27b-noreason` | Лучший dense Qwen в каталоге, без thinking — быстрые реплики |
| Карточка клиента (JSON) | `qwen3.8-27b-noreason` | Structured output / json_schema |
| Terra (подсказки) | `qwen3.6-fp8-noreason` | Fast-lane, короткий совет в панели |
| Sol (анализ) | `qwen3.8-27b` | Reasoning для разбора диалога |

GPT, ChatGPT и `api.openai.com` отключены на уровне клиента: запрос с таким `model_id` или URL отклоняется.

В `.env` нужен `LLM_API_KEY` (`sk-...` из кабинета NeuralDEEP).

## Training API

- `GET /api/v1/ai/runtime`
- `GET /api/v1/trainings` — список своих тренировок
- `POST /api/v1/trainings` — создать тренировку, карточку и первую реплику
- `GET /api/v1/trainings/{id}`
- `POST /api/v1/trainings/{id}/messages`
- `POST /api/v1/trainings/{id}/messages/stream`
- `POST /api/v1/trainings/{id}/hints`
- `POST /api/v1/trainings/{id}/complete` — завершить + Sol-анализ
- `POST /api/v1/trainings/{id}/abort`
- `POST /api/v1/trainings/{id}/analysis` — повторный/отдельный запуск Sol
- `GET /api/v1/stats/me`

Скрытая карточка не отдаётся менеджеру, пока тренировка не завершена.

## Этапы UI

- Этап 4: логин, сайдбар, дашборд, списки
- Этап 5: создание тренировки, чат с AI-клиентом, панель Terra, голосовой ввод (Web Speech API), завершение + переход к анализу Sol


## Admin API (РОП)

- `GET/POST /api/v1/admin/users`, `PATCH /api/v1/admin/users/{id}`
- `GET/POST/PATCH/DELETE /api/v1/admin/knowledge`
- `GET/POST /api/v1/admin/prompts`, `POST /api/v1/admin/prompts/{id}/activate`
- `GET/PUT /api/v1/admin/settings`
- `GET /api/v1/admin/trainings` — все тренировки команды
- `GET /api/v1/stats/managers/{id}`
