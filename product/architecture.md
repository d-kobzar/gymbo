# GymBo 2.0 — Architecture

## System Diagram

```
Telegram Client
  │
  ├── Mini App (TWA) ─► NestJS Server ─► PostgreSQL
  │    public/              │    │
  │    Telegram WebApp SDK  │    ├── REST API (NestJS modules)
  │    i18n module          │    ├── Telegram Auth (initData HMAC)
  │                         │    ├── OpenAI Assistants API
  │                         │    ├── Backblaze B2 (S3) for photos
  │                         │    └── node-cron scheduler
  │
  └── Bot Chat ─► Telegraf ─► same NestJS server
        /start, /coach       │
        notifications        └── Webhook handler
```

## Project Structure

```
gymbo/
├── product/                    # Product docs
├── public/                     # Frontend (Mini App UI)
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   ├── app.js              # Main init
│   │   ├── telegram.js         # TG WebApp SDK
│   │   ├── i18n.js             # Translation loader
│   │   ├── router.js           # SPA-like page router
│   │   └── api.js              # Auth-aware fetch wrapper
│   ├── locales/
│   │   ├── en.json
│   │   ├── ua.json
│   │   └── ru.json
│   ├── pages/                  # HTML page fragments
│   │   ├── home.html
│   │   ├── log.html
│   │   ├── progress.html
│   │   ├── coach.html
│   │   ├── program.html
│   │   ├── measurements.html
│   │   ├── exercises.html
│   │   └── settings.html
│   └── index.html              # SPA shell
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/
│   │   ├── database.config.ts
│   │   └── env.config.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── telegram-auth.guard.ts
│   │   ├── jwt-auth.guard.ts
│   │   └── jwt.strategy.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   └── user.model.ts
│   ├── exercises/
│   │   ├── exercises.module.ts
│   │   ├── exercises.controller.ts
│   │   ├── exercises.service.ts
│   │   └── exercise.model.ts
│   ├── training-logs/
│   │   ├── training-logs.module.ts
│   │   ├── training-logs.controller.ts
│   │   ├── training-logs.service.ts
│   │   └── training-log.model.ts
│   ├── measurements/
│   │   ├── measurements.module.ts
│   │   ├── measurements.controller.ts
│   │   ├── measurements.service.ts
│   │   ├── body-measurement.model.ts
│   │   └── measurement-photo.model.ts
│   ├── programs/
│   │   ├── programs.module.ts
│   │   ├── programs.controller.ts
│   │   ├── programs.service.ts
│   │   ├── program.model.ts
│   │   ├── program-day.model.ts
│   │   └── program-exercise.model.ts
│   ├── stats/
│   │   ├── stats.module.ts
│   │   ├── stats.controller.ts
│   │   └── stats.service.ts
│   ├── bot/
│   │   ├── bot.module.ts
│   │   ├── bot.service.ts
│   │   ├── bot.update.ts
│   │   └── scheduler.service.ts
│   ├── ai/
│   │   ├── ai.module.ts
│   │   ├── ai.controller.ts
│   │   ├── ai.service.ts
│   │   ├── ai-thread.model.ts
│   │   └── tools/
│   │       ├── tool-definitions.ts
│   │       └── tool-handlers.ts
│   ├── storage/
│   │   ├── storage.module.ts
│   │   └── storage.service.ts
│   ├── backup/
│   │   ├── backup.module.ts
│   │   ├── backup.controller.ts
│   │   └── backup.service.ts
│   ├── notifications/
│   │   ├── notifications.module.ts
│   │   ├── notifications.controller.ts
│   │   ├── notifications.service.ts
│   │   └── notification-setting.model.ts
│   └── i18n/
│       ├── i18n.module.ts
│       ├── i18n.service.ts
│       └── locales/
│           ├── en.json
│           ├── ua.json
│           └── ru.json
├── db/
│   └── migrations/
├── .env
├── .sequelizerc
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
└── package.json
```

## Database Schema (CamelCase Plural)

```sql
-- Users
CREATE TABLE "Users" (
  id            SERIAL PRIMARY KEY,
  "telegramId"  BIGINT UNIQUE NOT NULL,
  "chatId"      BIGINT,
  name          VARCHAR(255) NOT NULL,
  language      VARCHAR(2) DEFAULT 'en',
  timezone      VARCHAR(50) DEFAULT 'UTC',
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ DEFAULT NOW()
);

-- Exercises
CREATE TABLE "Exercises" (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", name)
);

-- TrainingLogs
CREATE TABLE "TrainingLogs" (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
  "exerciseId"  INTEGER REFERENCES "Exercises"(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  "setNumber"   INTEGER NOT NULL,
  reps          INTEGER NOT NULL,
  weight        DECIMAL(6,2) NOT NULL,
  rir           INTEGER,
  "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

-- BodyMeasurements
CREATE TABLE "BodyMeasurements" (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  weight        DECIMAL(5,1),
  shoulders     DECIMAL(5,1),
  arm           DECIMAL(5,1),
  chest         DECIMAL(5,1),
  waist         DECIMAL(5,1),
  abs           DECIMAL(5,1),
  glutes        DECIMAL(5,1),
  thigh         DECIMAL(5,1),
  calf          DECIMAL(5,1),
  "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);

-- MeasurementPhotos
CREATE TABLE "MeasurementPhotos" (
  id              SERIAL PRIMARY KEY,
  "measurementId" INTEGER REFERENCES "BodyMeasurements"(id) ON DELETE CASCADE,
  "userId"        INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
  "s3Key"         VARCHAR(500) NOT NULL,
  label           VARCHAR(50),  -- 'front', 'side', 'back'
  "createdAt"     TIMESTAMPTZ DEFAULT NOW()
);

-- Programs
CREATE TABLE "Programs" (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER REFERENCES "Users"(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,
  name          VARCHAR(255),
  "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("userId", version)
);

-- ProgramDays
CREATE TABLE "ProgramDays" (
  id            SERIAL PRIMARY KEY,
  "programId"   INTEGER REFERENCES "Programs"(id) ON DELETE CASCADE,
  day           VARCHAR(20) NOT NULL,
  "isRest"      BOOLEAN DEFAULT false
);

-- ProgramExercises
CREATE TABLE "ProgramExercises" (
  id              SERIAL PRIMARY KEY,
  "programDayId"  INTEGER REFERENCES "ProgramDays"(id) ON DELETE CASCADE,
  "exerciseId"    INTEGER REFERENCES "Exercises"(id) ON DELETE CASCADE,
  sets            INTEGER DEFAULT 3,
  "sortOrder"     INTEGER DEFAULT 0
);

-- NotificationSettings
CREATE TABLE "NotificationSettings" (
  id                    SERIAL PRIMARY KEY,
  "userId"              INTEGER REFERENCES "Users"(id) ON DELETE CASCADE UNIQUE,
  "trainingReminder"    BOOLEAN DEFAULT true,
  "trainingTime"        VARCHAR(5) DEFAULT '18:00',
  "trainingDays"        INTEGER[] DEFAULT '{1,3,5}',
  "measurementReminder" BOOLEAN DEFAULT true,
  "measurementDay"      INTEGER DEFAULT 1,
  "measurementTime"     VARCHAR(5) DEFAULT '09:00',
  "weeklySummary"       BOOLEAN DEFAULT true,
  "createdAt"           TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ DEFAULT NOW()
);

-- AiThreads (maps user to OpenAI Assistants thread)
CREATE TABLE "AiThreads" (
  id            SERIAL PRIMARY KEY,
  "userId"      INTEGER REFERENCES "Users"(id) ON DELETE CASCADE UNIQUE,
  "threadId"    VARCHAR(100) NOT NULL,  -- OpenAI thread_xxx
  "assistantId" VARCHAR(100) NOT NULL,  -- OpenAI asst_xxx
  "createdAt"   TIMESTAMPTZ DEFAULT NOW()
);
```

## Environment Variables

```env
# Database
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gymbo

# Auth
JWT_SECRET=random-secret-here

# Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
APP_URL=https://your-domain.com

# OpenAI Assistants
OPENAI_API_KEY=

# Backblaze B2 (S3-compatible)
B2_ENDPOINT=https://s3.us-west-004.backblazeb2.com
B2_REGION=us-west-004
B2_KEY_ID=
B2_APP_KEY=
B2_BUCKET=gymbo-photos
```
