# GymBo Refactor — Decisions, Deferred Items, Open Questions

Spec: production refactor across 6 phases. This file logs decisions, open
questions, and items intentionally deferred from the current phase.

---

## Decisions

### Phase 1

- **Sequelize CLI config split.** Spec acceptance says `src/config/` must be
  deleted. `database.config.ts` (NestJS) and `database.config.js`
  (sequelize-cli) serve different runtimes. Moving:
    - `src/config/database.config.ts` → `src/core/config/database.config.ts`
      (a `registerAs('database', …)` function consumed via `ConfigService`).
    - `src/config/database.config.js` → `db/config.js` (colocated with
      migrations). `.sequelizerc` updated to point at the new path.
- **`nestjs-pino` over raw `pino` wiring.** Gives us automatic request-id,
  request logging, and clean integration with the Nest `Logger` token.
- **`uuid` added** as the source of request IDs consumed by `nestjs-pino`'s
  `genReqId`.
- **`ConfigModule.forRoot({ validate, isGlobal: true, load: [...] })`** is the
  only place env is read. All new code uses `ConfigService.get<T>(...)`.
  Legacy `process.env.*` access in domain modules remains for Phase 1 — it
  will migrate in Phase 2 when those modules move.
- **Response envelope.** Success responses are wrapped as `{ data, meta }`
  via the global transform interceptor. Opt-out via `@Raw()` on:
    - `GET /health` (shape dictated by `@nestjs/terminus`)
    - `POST /bot/webhook` (Telegram expects empty-ish body)
    - All static files (not controllers; not affected by interceptor anyway)
  Frontend `api.js` unwraps `.data` if the response is an envelope; falls
  back to the raw body for opted-out endpoints.
- **Error envelope.** All non-2xx go through `AllExceptionsFilter` and
  produce `{ error: { code, message, details }, requestId }`. Legacy code
  that throws plain `Error` still works — the filter normalizes.
- **Jest / test infrastructure deferred.** Phase 1 doesn't move domain code
  or introduce behavior that demands tests. Jest setup happens as soon as
  Phase 2 starts (domain module moves require smoke tests per spec §0.6).
- **Lint deferred.** Spec references `npm run lint`; no linter is currently
  configured. ESLint + config will be added alongside Jest in early Phase 2.

---

## Deferred items (log here instead of implementing)

- ESLint + Prettier configuration (add in Phase 2 ahead of moves).
- Jest + test infra setup (add in Phase 2 ahead of moves).
- `telegram-webhook.guard.ts` enforcement — spec slot is Phase 4.
- `class-validator` DTOs for controller inputs currently using plain types —
  Phase 2 when each module moves into `src/modules/<name>/dto/`.
- `parse-object-id.pipe.ts` — not needed until a controller actually uses it.
- **B2 health check returns 503** with `"b2":{"status":"down","message":"UnknownError"}`
  on the local `.env`. Likely the supplied B2 application key is scoped to
  `listFiles`/`getObject` rather than `HeadBucket`. Don't break Phase 1 over
  a runtime-credential issue — possible fixes for later:
    1. Swap `HeadBucketCommand` for a cheaper `ListObjectsV2Command` with
       `MaxKeys: 1` (usually allowed on bucket-scoped keys).
    2. Gate the indicator behind a `HEALTH_CHECK_B2=false` env flag in dev.
  When Phase 2 moves `storage` into `src/modules/`, revisit.
- **Health success shape**: spec §5 Def-of-Done mentions `{ status, checks }`
  — `@nestjs/terminus` returns `{ status, info, error, details }`. Keeping
  the native terminus shape for now; if the spec literal is load-bearing,
  add a small response reshaper in `HealthController`.

---

## Open questions (`CLAUDE-QUESTION:`)

_None open at the moment. Log with the exact `CLAUDE-QUESTION:` prefix in
code comments when you need to ask the user a blocking question; promote the
resolution here when it's answered._
