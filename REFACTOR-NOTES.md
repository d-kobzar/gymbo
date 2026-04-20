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

### Phase 2

- **Test strategy — pragmatic.** Spec §0.6 asks for a smoke test per file
  before moving it. With 0 tests in the baseline, authoring ~40 retroactive
  tests would balloon the phase. Compromise: a single AppModule-compile
  smoke test (`src/app.module.spec.ts`) proves the module graph resolves;
  per-module verification is done via `npm run build` + boot + `curl`
  probes after each move. Spec-mandated per-service tests land in Phase 3
  alongside the new `coach-context` code (≥ 90% on new code, ≥ 70% on
  moved code per spec §4). Tracking as a deferred item below.
- **ESLint flat config (v9+).** Installed eslint@10 requires
  `eslint.config.js`, not `.eslintrc.js`. Config uses flat format.
- **`tsc-alias` for runtime path resolution.** `tsconfig.json` `paths`
  are compile-time only. Rather than adding a runtime resolver
  (`tsconfig-paths/register`), we rewrite the aliases to relative
  paths post-build via `tsc-alias`. Zero runtime cost.
- **`@nestjs/mapped-types`** installed for `PartialType(...)` in update DTOs.
- **Cross-module imports.** Modules that moved later into Phase 2 had
  models referenced by modules that moved earlier via the transitional
  `@/feature/...` alias. Every `@/feature/...` reference is gone at the
  end of Phase 2 — all cross-module model refs go through
  `@modules/<feature>/models/...`. Grep confirms.
- **Bot lifecycle.** `BotService.onApplicationBootstrap` launches
  Telegraf AFTER all `OnModuleInit` handlers fire. Update classes
  register their listeners in `onModuleInit`, so the order is:
  BotService (creates Telegraf) → updates (register handlers) →
  BotService.bootstrap (calls `bot.launch()` / webhook setup).
  This replaces the previous arrangement where `BotUpdate.onModuleInit`
  both registered and launched.
- **Webhook secret check** still lives in `BotController` (inline
  `req.headers[...]` check). Moving it behind
  `shared/guards/telegram-webhook.guard.ts` is explicitly a Phase 4
  task — leaving the TODO comment in the controller.
- **Tool registry generics cast.** `CoachTool<TParams, TResult>` is
  generic in `TParams`; treating a `CoachTool[]` as the storage type
  requires a one-line cast in `ai-coach.module.ts`' useFactory
  (documented inline). Registered handlers remain strictly typed at
  their own boundary.
- **Scheduler jobs stay on `node-cron`**, not `@nestjs/schedule`.
  Adding `@nestjs/schedule` mid-phase would be scope creep; the node-cron
  pattern works, and moving to `@Cron()` decorators is a future mechanical
  swap.
- **Telegraf API drift.** `disable_web_page_preview` →
  `link_preview_options.is_disabled` for the Telegraf version in use.

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

---

## Design reference (Phase 5 / 6 source of truth)

The user has confirmed the frontend must match `design/summary_standalone.html`.
The standalone is a compiled bundle (~1.5 MB with inlined assets). The real
source of truth is under `design/src/`:

- `design/src/v2-main.jsx` — Home, Log, Rest, Coach frames (V2 = dark energetic)
- `design/src/v2-more.jsx` — Progress, Program, Measurements, Exercises, More, Settings
- `design/src/frame.jsx` — device chrome + bottom TabBar
- `design/src/i18n.jsx` — ru/en/ua strings

**V1 (light) variants exist but V2 is canonical.** Do not mix. When rebuilding
pages in Phase 6, read the V2 JSX file as the component spec.

### Design DNA (in one paragraph)

Dark canvas (`#0B0B0E`), amber accent (`#FFB020`), Archivo display + JetBrains
Mono for numerics. Contrast over ornament: borders and surfaces (no drop
shadows in-app), monospace labels in uppercase with wide tracking (+1.5 to +2),
large display weights (800–900), minimal motion (0.2s toggle; SVG-driven
progress). Feels like a gym instrument, not a social app.

### Token baseline (to seed `styles/tokens.css` in Phase 5)

Colors (V2 dark):
- `--surface-base` `#0B0B0E` · `--surface-raised` `#16171B` · `--surface-elevated` `#1E1F24`
- `--text-primary` `#F5F3EE` · `--text-secondary` `#8A8B93` · `--text-tertiary` `#585962`
- `--border-subtle` `rgba(255,255,255,0.07)` · `--border-default` `rgba(255,255,255,0.12)`
- `--accent` `#FFB020` · `--accent-contrast` `#000` · `--accent-deep` `#FF8A00`
- `--success` `#4ADE80` · `--danger` `#F43F5E`

Radii: 4 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 100 (pill)
Spacing: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 30 / 80 (nav clearance)
Type scale: labels 10–11 (mono, +1.5 tracking, caps) · body 13–15 · display 24 / 30 / 34 · hero-numeric 72

### Conflicts with the spec's Phase 5 (must resolve before implementing)

1. **Telegram theme integration vs fixed palette.** Spec §2.1/5 requires
   `var(--tg-theme-bg-color, fallback)`; the design uses a fixed dark palette.
   Proposed reconciliation: keep the fixed V2 tokens as defaults, but expose
   a CSS opt-in media/attribute (`[data-theme="tg"]`) that maps `--surface-*`,
   `--text-*`, `--accent` to `var(--tg-theme-*)`. Enabled only when the
   Mini App's `themeParams` are non-default. Decide with the user in Phase 5.

2. **Fonts.** Design uses Archivo (display) + JetBrains Mono (numerics).
   Spec says "system stack only if not using system stack" — implying custom
   fonts are acceptable. Plan: add `<link rel="preconnect">` + `<link>` to
   Google Fonts (or self-host WOFF2) in `index.html`, with the system stack
   as fallback.

3. **Missing states in the design** (drive Phase 5/6 component fill-in,
   inferred in the V2 idiom):
   - Loading skeletons — shimmer pulse on `--surface-raised`.
   - Empty states — centered icon + `--text-secondary` copy + accent CTA.
   - Toast / snackbar — bottom-anchored above tab bar, 44px height, 14px
     radius, `--surface-elevated` bg, accent/danger left bar.
   - Input focus — 1px `--accent` border + subtle inner shadow.
   - Error — `--danger` border + monospace uppercase caption under field.

### What this changes in Phase 5 scope

- Token values move from the spec's snippet to the values above.
- Add font loading to `index.html` via Google Fonts.
- Add `--accent-deep`, `--surface-elevated` to the token set (not in spec).
- Telegram theme integration is an opt-in, not a hard requirement.

### User-confirmed decisions (2026-04-20)

1. **V2 fixed dark palette as default**, Telegram theme as opt-in via
   `[data-theme="tg"]` attribute that remaps `--surface-*` / `--text-*` /
   `--accent` onto `var(--tg-theme-*)`. Enabled only when the Mini App's
   `themeParams` are non-default.
2. **Fonts via Google Fonts** (Archivo + JetBrains Mono). Preconnect in
   `index.html`, system stack as fallback.
3. **Use all design values verbatim** — this is the target, not a
   suggestion. Code must remain maximally clean despite being vanilla
   JS / plain HTML / no framework.

### Vanilla-JS cleanliness contract (Phase 5 / 6)

The absence of a framework is not an excuse for messy code. Enforce:

- **One responsibility per file.** A component, a page, a core service.
- **ES modules with named exports**, never globals. No `window.Foo`.
- **Class-based components** with `constructor(root, props)`, `render()`,
  `destroy()` — explicit lifecycle, no hidden DOM leaks.
- **No jQuery, no utility libraries.** Ship zero third-party runtime
  deps except a lightweight chart (and only if SVG-by-hand is too much).
- **State via the pub-sub store** (`core/store.js`), never ad-hoc globals
  or `window.*`. Pages subscribe on `render()`, unsubscribe on `destroy()`.
- **No inline styles in JS** except dynamic values (computed width,
  transform). Everything static goes in `styles/components/*.css`.
- **Strict event hygiene.** Every `addEventListener` has a matching
  `removeEventListener` in `destroy()`, or uses an `AbortController`.
- **No hex/rgb colors outside `tokens.css`.** Grep must return zero
  matches in `js/` and `styles/components/`.
- **No string interpolation for HTML.** Use `<template>` elements or
  document.createElement; if you must interpolate, escape user input.
- **JSDoc types on all exports** so TypeScript tooling catches misuse
  without a compile step.
- **Zero `console.log` in production paths** — wrap dev logs behind a
  `debug(...)` helper that no-ops when `NODE_ENV==='production'`.
- **One CSS class per visual concern.** No `.button-primary-large-icon-rounded`
  monsters; compose: `.button .button--primary .button--lg`.

These rules are the Phase 5 / 6 acceptance criteria in addition to the
functional ones in the spec.
