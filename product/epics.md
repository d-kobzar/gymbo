# GymBo 2.0 — Epics & Tasks

## Epic 1: Project Scaffold & Config

Set up NestJS project with all tooling.

- [ ] 1.1 Init NestJS project with `nest new` (or manual)
- [ ] 1.2 Install dependencies: sequelize, sequelize-typescript, pg, telegraf, nestjs-telegraf, openai, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, multer, node-cron, passport, passport-jwt, @nestjs/jwt, @nestjs/passport, class-validator, class-transformer
- [ ] 1.3 Configure `.env` with all variables
- [ ] 1.4 Create `src/config/database.config.ts` — Sequelize connection
- [ ] 1.5 Create `src/config/env.config.ts` — typed env validation
- [ ] 1.6 Configure `app.module.ts` with all modules
- [ ] 1.7 Set up static file serving for `public/`
- [ ] 1.8 Create `.sequelizerc` pointing to db/migrations
- [ ] 1.9 Create `tsconfig.json`, `nest-cli.json`

---

## Epic 2: Database Models & Migrations

All models with CamelCase plural table names.

- [ ] 2.1 Create `user.model.ts` → table `Users`
- [ ] 2.2 Create `exercise.model.ts` → table `Exercises`
- [ ] 2.3 Create `training-log.model.ts` → table `TrainingLogs`
- [ ] 2.4 Create `body-measurement.model.ts` → table `BodyMeasurements`
- [ ] 2.5 Create `measurement-photo.model.ts` → table `MeasurementPhotos`
- [ ] 2.6 Create `program.model.ts` → table `Programs`
- [ ] 2.7 Create `program-day.model.ts` → table `ProgramDays`
- [ ] 2.8 Create `program-exercise.model.ts` → table `ProgramExercises`
- [ ] 2.9 Create `notification-setting.model.ts` → table `NotificationSettings`
- [ ] 2.10 Create `ai-thread.model.ts` → table `AiThreads`
- [ ] 2.11 Create migration `001-initial-schema.js` with all tables
- [ ] 2.12 Define all associations in models index

---

## Epic 3: Auth Module

Telegram-first authentication with JWT fallback.

- [ ] 3.1 Create `auth.module.ts`
- [ ] 3.2 Create `auth.service.ts` — validate initData HMAC, upsert user, issue JWT
- [ ] 3.3 Create `auth.controller.ts` — POST `/auth/telegram` exchanges initData for JWT
- [ ] 3.4 Create `telegram-auth.guard.ts` — validates X-Telegram-Init-Data header
- [ ] 3.5 Create `jwt.strategy.ts` and `jwt-auth.guard.ts` — standard JWT guard
- [ ] 3.6 Create combined guard that accepts either Telegram or JWT
- [ ] 3.7 Create `users.service.ts` — findByTelegramId, create, update

---

## Epic 4: Core API Modules

CRUD for all data with pagination, export, import.

### 4a: Exercises
- [ ] 4a.1 Create `exercises.module.ts`
- [ ] 4a.2 Create `exercises.service.ts` — CRUD with userId scoping
- [ ] 4a.3 Create `exercises.controller.ts` — GET, POST, PUT, DELETE `/exercises`

### 4b: Training Logs
- [ ] 4b.1 Create `training-logs.module.ts`
- [ ] 4b.2 Create `training-logs.service.ts` — CRUD, pagination, PR detection, progress query
- [ ] 4b.3 Create `training-logs.controller.ts` — GET, POST, PUT, DELETE `/training-logs`, GET `/training-logs/progress`, GET `/training-logs/export`

### 4c: Body Measurements
- [ ] 4c.1 Create `measurements.module.ts`
- [ ] 4c.2 Create `measurements.service.ts` — CRUD, progress, photo attachment
- [ ] 4c.3 Create `measurements.controller.ts` — CRUD + POST `/measurements/:id/photos` (multipart upload)

### 4d: Programs
- [ ] 4d.1 Create `programs.module.ts`
- [ ] 4d.2 Create `programs.service.ts` — versioned CRUD with days/exercises
- [ ] 4d.3 Create `programs.controller.ts` — GET versions, GET current, POST, DELETE

### 4e: Stats
- [ ] 4e.1 Create `stats.module.ts`
- [ ] 4e.2 Create `stats.service.ts` — dashboard, PRs, calendar, volume
- [ ] 4e.3 Create `stats.controller.ts` — GET `/stats/dashboard`, `/stats/prs`, `/stats/calendar`, `/stats/volume`

### 4f: Backup & Import
- [ ] 4f.1 Create `backup.module.ts`
- [ ] 4f.2 Create `backup.service.ts` — export all data as JSON, import from v1 JSON format
- [ ] 4f.3 Create `backup.controller.ts` — GET `/backup/export`, POST `/backup/import`

---

## Epic 5: Backblaze B2 Storage

S3-compatible photo storage.

- [ ] 5.1 Create `storage.module.ts`
- [ ] 5.2 Create `storage.service.ts` — upload(buffer, key), getSignedUrl(key), delete(key)
- [ ] 5.3 Wire into measurements controller for photo upload
- [ ] 5.4 Add signed URL generation to measurement GET responses

---

## Epic 6: Telegram Bot (Telegraf)

Bot with commands and notifications.

- [ ] 6.1 Create `bot.module.ts` with Telegraf setup
- [ ] 6.2 Create `bot.update.ts` — /start (welcome + Mini App button), /stats, /settings, /coach
- [ ] 6.3 Create `bot.service.ts` — sendMessage helper, language detection
- [ ] 6.4 Create `scheduler.service.ts` — cron jobs for training/measurement reminders and weekly summaries
- [ ] 6.5 Wire webhook endpoint in NestJS
- [ ] 6.6 Create `notifications.controller.ts` — GET/PUT `/notifications` for settings

---

## Epic 7: OpenAI Assistants Integration

AI coach with persistent threads stored on OpenAI side.

- [ ] 7.1 Create `ai.module.ts`
- [ ] 7.2 Create `tool-definitions.ts` — function tool schemas (get_stats, get_workouts, get_prs, get_measurements, get_program, get_progress, get_volume)
- [ ] 7.3 Create `tool-handlers.ts` — execute tool calls against services
- [ ] 7.4 Create `ai.service.ts`:
  - On first chat: create OpenAI Assistant (or use existing), create Thread, store in AiThreads
  - On message: add to thread, run assistant, handle tool calls, return response
- [ ] 7.5 Create `ai.controller.ts` — POST `/ai/chat`, DELETE `/ai/history`
- [ ] 7.6 Wire /coach bot command to ai.service

---

## Epic 8: i18n

Translations for EN, UA, RU.

- [ ] 8.1 Create `i18n.service.ts` — t(key, lang, params)
- [ ] 8.2 Create backend locale files `src/i18n/locales/{en,ua,ru}.json`
- [ ] 8.3 Create frontend `public/js/i18n.js` — fetch + apply translations
- [ ] 8.4 Create frontend locale files `public/locales/{en,ua,ru}.json`
- [ ] 8.5 Translate all strings to UA and RU

---

## Epic 9: Mobile-First UI 2.0

Sophisticated Telegram Mini App frontend.

- [ ] 9.1 Create `public/index.html` — SPA shell with nav, page container
- [ ] 9.2 Create `public/css/style.css` — design system (variables, typography, components)
- [ ] 9.3 Create `public/js/app.js` — main init (TG, auth, i18n, router)
- [ ] 9.4 Create `public/js/telegram.js` — WebApp SDK (theme, haptics, back button)
- [ ] 9.5 Create `public/js/api.js` — auth-aware fetch wrapper
- [ ] 9.6 Create `public/js/router.js` — hash-based SPA router
- [ ] 9.7 Create pages: home, log, progress, coach, program, measurements, exercises, settings
- [ ] 9.8 Add photo upload UI to measurements page
- [ ] 9.9 Add JSON import UI to settings page
- [ ] 9.10 Add language picker to settings

---

## Implementation Order

1. Epic 1 — Scaffold
2. Epic 2 — DB models
3. Epic 3 — Auth
4. Epic 8 — i18n (needed by bot and UI)
5. Epic 4 — Core API
6. Epic 5 — Storage
7. Epic 6 — Bot
8. Epic 7 — AI
9. Epic 9 — UI 2.0
