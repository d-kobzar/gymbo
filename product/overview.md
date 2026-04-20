# GymBo 2.0 — Product Overview

**Bot:** [@smart_gymbot](https://t.me/smart_gymbot)
**Platform:** Telegram Mini App
**Stack:** NestJS, Sequelize, PostgreSQL, Telegraf, OpenAI Assistants, Backblaze B2

---

## Vision

GymBo is a Telegram-native fitness tracker. One tap from the bot — full gym companion. No app stores, no sign-up forms. Identity from Telegram, AI coach that knows your data, progress photos stored in the cloud.

## Core Features

### Carried from v1
- Workout logging (exercises, sets, reps, weight, RIR)
- Body measurements (11 metrics)
- Training program builder (versioned weekly splits)
- Progress charts & personal records
- Dashboard with stats, calendar, volume
- Rest timer with vibration + alarm
- Dark/Light theme
- Data export (CSV, JSON)

### New in v2
- **Greenfield NestJS** — Clean architecture, modular, scalable
- **Telegram Mini App** — Native-feel mobile UI
- **Telegram Auth** — Zero-friction, identity from Telegram
- **Progress Photos** — Attach photos to measurements, stored on Backblaze B2
- **OpenAI Assistants** — AI coach with persistent threads (stored on OpenAI side)
- **i18n** — EN / UA / RU with Telegram language auto-detect
- **Bot Notifications** — Training reminders, measurement prompts, weekly summaries
- **JSON Import** — Upload old data from v1 export

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| File names | kebab-case | `training-log.model.ts` |
| Class names | PascalCase | `TrainingLog` |
| Variable names | camelCase | `trainingLog` |
| DB table names | PascalCase plural | `TrainingLogs` |
| API routes | kebab-case | `/training-logs` |
