# GymBo — Telegram Mini App фитнес-трекер с AI-коучем

## Назначение

**GymBo** — платформа для трекинга тренировок и персонального коучинга, реализованная в виде Telegram Mini App. Приложение объединяет логирование тренировок, учёт антропометрии и AI-коуча прямо внутри Telegram: пользователь открывает бота — и моментально получает персонального тренировочного ассистента без установки приложений из сторов и без регистрации. Аутентификация построена на нативной идентификации Telegram (initData + HMAC-подпись).

Продуктовая документация лежит в `product/overview.md`, `product/architecture.md`, `product/epics.md`.

## Технологический стек

- **Backend:** NestJS 11 на TypeScript, Node.js
- **База данных:** PostgreSQL через Sequelize ORM + `sequelize-typescript`
- **Бот:** Telegraf 4.16 + `nestjs-telegraf`
- **AI:** OpenAI Assistants API (gpt-4o), персистентные треды на пользователя
- **Хранилище файлов:** Backblaze B2 (S3-совместимое) через `@aws-sdk/client-s3`, подписанные URL
- **Auth:** JWT (`@nestjs/jwt` + `passport-jwt`) поверх валидации Telegram initData
- **Планировщик:** `node-cron` для напоминаний
- **Фронтенд:** ванильный JS + Telegram WebApp SDK, статика отдаётся через `@nestjs/serve-static`
- **i18n:** EN / UA / RU на бэке и на фронте

## Структура

### Entry points

- `src/main.ts` — bootstrap NestJS, глобальный `ValidationPipe` (whitelist + transform), CORS, префикс `/api` (кроме `/` и `/bot/webhook`), лимит payload 50MB, порт 3000.
- `src/app.module.ts` — оркестрация 13 feature-модулей + Sequelize + раздача статики из `public/`.

### Backend-модули (`src/`)

**Инфраструктура**
- `config/` — конфигурация БД и окружения.
- `auth/` — валидация Telegram initData, выпуск JWT, Passport-стратегия.
- `users/` — пользователи (Telegram ID, chat ID, язык, таймзона).
- `i18n/` — сервис переводов с вложенными ключами и параметрами.
- `storage/` — S3-клиент для Backblaze B2 (upload, signed URL, delete).

**Тренировочный контур**
- `training-logs/` — посетовое логирование (дата, упражнение, повторы, вес, RIR), пагинация, фильтры, агрегаты прогресса (объём и max вес по датам).
- `exercises/` — пользовательский каталог упражнений (уникальность per user+name).
- `programs/` — версионируемые программы: `Program → ProgramDays → ProgramExercises`, недельный сплит, сортировка, rest-дни.

**Прогресс и аналитика**
- `measurements/` — 11 метрик тела (вес, плечи, рука, грудь, талия, пресс, ягодицы, бедро, голень и т.д.), фото прогресса с лейблами `front/side/back`, подписанные S3-ссылки.
- `stats/` — дашборд: недельные сеты, объём, дни тренировок, PR по упражнениям, календарная тепловая карта, недельный объём по упражнениям.

**Бот и уведомления**
- `bot/` — жизненный цикл Telegraf-бота, определение языка по Telegram user, команды (`/start`, `/stats`, `/settings`, `/coach`), inline-кнопки смены языка, чанкование длинных сообщений под лимит 4096 символов, автороутинг свободного текста в AI.
- `notifications/` — cron-задачи (ежеминутная проверка напоминаний о тренировке и замерах против пользовательских настроек; еженедельный summary по воскресеньям в 10:00 UTC), уважение таймзоны и пользовательских предпочтений.

**AI-коуч (`ai/`)**
- Singleton assistant (gpt-4o), тред на пользователя хранится в `AiThreads`.
- Tool-calling с циклом до 10 раундов. Доступные инструменты: `get_user_stats`, `get_workouts`, `get_personal_records`, `get_measurements`, `get_current_program`, `get_exercise_progress`, `get_volume_analysis`.
- Персона — коуч школы Арнольда: доказательная методология, MEV/MAV/MRV, ауторегуляция через RIR, прогрессивная перегрузка.

**Данные**
- `backup/` — полный JSON-экспорт (упражнения, тренировки, замеры, программы), импорт v1-формата с резолвом exercise ID (по id и по имени), транзакционный rollback.

### База данных (`db/migrations/`)

PostgreSQL, таблицы в CamelCase plural: `Users`, `Exercises`, `TrainingLogs`, `BodyMeasurements`, `MeasurementPhotos`, `Programs`, `ProgramDays`, `ProgramExercises`, `NotificationSettings`, `AiThreads`. Базовая миграция — `20260416100000-initial-schema.js`.

### Frontend (`public/`)

Telegram Mini App как SPA на ванильном JS:

- `index.html` — оболочка приложения.
- `css/style.css` — дизайн-система на CSS-переменных, mobile-first.
- `pages/` — HTML-фрагменты экранов: home, log, progress, coach, program, measurements, exercises, settings — загружаются динамически.
- `js/app.js` — инициализация Telegram WebApp SDK, обмен initData на JWT, старт роутера.
- `js/telegram.js` — обёртка над WebApp SDK (тема, хаптика, back-кнопка).
- `js/api.js` — fetch-клиент с автоподстановкой Bearer-токена.
- `js/router.js` — hash-роутер.
- `js/i18n.js` — рантайм-локализация.
- `locales/` — `en.json`, `ua.json`, `ru.json`; язык определяется из Telegram user.

## Переменные окружения (`.env`)

- `DATABASE_URL` — PostgreSQL.
- `JWT_SECRET` — подпись токенов.
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `APP_URL` — бот и webhook.
- `OPENAI_API_KEY` — AI-коуч.
- `B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET` — Backblaze B2.

## Ключевые возможности

1. **Вход в один тап** через Telegram — без паролей и email-верификаций.
2. **Персистентный AI-коуч** с доступом ко всей истории тренировок и метрикам через tool-calls.
3. **Посетовое логирование с RIR** — точная ауторегуляция и анализ объёма под гипертрофию.
4. **Фото прогресса и 11 антропометрических метрик** с отдельными графиками.
5. **Автоматические напоминания** (тренировка, замеры, weekly summary) с учётом таймзоны.
6. **Версионируемые программы** с недельным сплитом и rest-днями.
7. **Мультиязычность** EN / UA / RU с автодетектом.
8. **Экспорт/импорт данных** с транзакционной целостностью.

## Скрипты (`package.json`)

- `npm run start:dev` — dev-режим Nest с watch.
- `npm run build` / `npm run start:prod` — продовая сборка.
- `npm run migrate` / `migrate:undo` / `migrate:undo:all` — миграции Sequelize CLI.
