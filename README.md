# NCL Sales Trainer = NeuroCloser

**NeuroCloser** — AI-тренажёр дожатия B2B-сделок для менеджеров дистрибьютора электронных компонентов.

Менеджер ведёт переговоры с AI-клиентом (закупщик / главный инженер / снабженец завода или КБ в РФ), учится выявлять производственную боль, давать экспертную презентацию цепочки поставок и закрывать на следующий шаг: **BOM**, встреча с инженером, **NDA**, опытная партия.

Стек: **FastAPI · PostgreSQL · Redis · Next.js 14 · Nginx**. Все LLM — только [NeuralDEEP](https://neuraldeep.ru/) PRO (`https://api.neuraldeep.ru/v1`). GPT/OpenAI отключены.

---

## Возможности

| Для менеджера | Для РОПа |
| --- | --- |
| Тренировки с AI-клиентом по отрасли и роли | Команда, база знаний, AI-настройки |
| Подсказки **Terra** в реальном времени | Просмотр тренировок команды |
| Голос → текст (Whisper через NeuralDEEP) | Статистика менеджеров |
| **Радар 6 компетенций** после каждой реплики | Модели чата / Terra / Sol / радара |
| Разбор **Sol**: оценки, резюме, зоны роста | Итоговый радар и скрытая карточка после сессии |

**Радар компетенций:** выявление боли, презентация, возражения, закрытие, техника, риски (0–100%, накопительно 70/30). Счётчики: свои реплики / запросы подсказок.

В диалоге клиент представляется **по сгенерированной карточке** (ФИО + компания). Скрытая боль открывается только после завершения сессии.

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
| РОП | `admin@ncl.local` | `ChangeMe_Admin_123` (или `SEED_ADMIN_PASSWORD`) |
| Менеджер | `manager1@ncl.local` … `manager3@ncl.local` | `ChangeMe_Manager_123` (или `SEED_MANAGER_PASSWORD`) |

---

## NeuralDEEP — модели (по умолчанию)

| Задача | Ключ настройки | Модель |
| --- | --- | --- |
| Диалог AI-клиента | `client_model_id` | `qwen3.6-fp8-noreason` |
| Карточка клиента | `card_model_id` | `qwen3.6-fp8-noreason` |
| Terra (подсказки) | `hint_model_id` | `qwen3.6-fp8-noreason` |
| Радар реплики | `radar_model_id` | `qwen3.6-fp8-noreason` |
| Sol (разбор) | `analyst_model_id` | `qwen3.8-27b-noreason` |

Модели и тарифы правятся в админке `/admin/settings`. Обработка в РФ (152-ФЗ).

---

## API (кратко)

**Auth:** `POST /api/v1/auth/login|refresh|logout`, `GET /api/v1/auth/me`

**Тренировки:**
- `GET/POST /api/v1/trainings`
- `GET /api/v1/trainings/{id}` — в т.ч. `client_brief`, `client_label`, `radar_scores`
- `POST .../messages`, `.../messages/stream`
- `POST .../hints`, `.../analyze-message`, `.../complete`, `.../abort`, `.../analysis`
- `POST /api/v1/speech/transcribe`

**РОП:** `/api/v1/admin/users|knowledge|prompts|settings|trainings`, `/api/v1/stats/...`

---

## Этапы

1. Инфраструктура Docker + auth  
2. Карточка клиента + диалог NeuralDEEP  
3. Админка РОПа (команда, KB, настройки)  
4. UI менеджера (дашборд, история)  
5. Чат, Terra, голос, Sol  
5.5. **Real-time радар компетенций**, русские лейблы, счётчики реплик/подсказок  

Презентация для заказчика: [PRESENTATION.md](PRESENTATION.md)
