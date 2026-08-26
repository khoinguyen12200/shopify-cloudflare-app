---
description: Cloudflare Workers infra — the services that are in scope and the ones that must not be added, the limits that change design, config and runtime invariants, deploy order. Apply when touching wrangler config, workers/, bindings, drizzle/, or scripts/.
globs:
  - "wrangler.jsonc"
  - "wrangler.toml"
  - "workers/**"
  - "drizzle/**"
  - "scripts/**"
  - "app/db/**"
  - "package.json"
alwaysApply: true
---

# Cloudflare Workers

## The service list — closed by default

In scope means *allowed*, not *already wired*. Declare a binding when a feature
needs it; do not scaffold one speculatively.

| Service | Used for | Rule |
|---|---|---|
| **Workers** | The app (SSR) + webhooks | One Worker, one deployed env |
| **Static Assets** | Client bundle | The `assets` binding — not Pages |
| **D1** | All relational state | `@rules/data.md` |
| **KV** | Shopify sessions + hot read cache | Eventually consistent — never the source of relational truth. Shop-scoped keys, invalidate at the write site |
| **Queues** | Webhook → pipeline handoff | At-least-once ⇒ idempotent consumers, backoff that spans an outage (not a minute), and a **dead-letter queue** |
| **Cron Triggers** | Periodic sweeps | One `scheduled` handler; each sweep guards its own errors so one failure never costs the others their tick |
| **Email Sending** | Transactional email | Verified sender domain from `vars`; failures leave a retryable record |
| **Rate Limiting** | Runaway clients / webhook floods | Config-only binding, fails open when absent |
| **Observability** | Logs | `enabled: true` + `head_sampling_rate`, structured JSON |
| **Workers AI** | Text generation behind a chosen model | Binding only — no API key exists to leak. Every call goes through the port in `app/ports/ai.ts`, is metered into `ai_runs`, and names a ROLE rather than a model id |

**Everything else is out of scope until a written reason says otherwise** —
Durable Objects, Hyperdrive, Vectorize, Browser Rendering, Images,
Stream, Containers, Analytics Engine, service bindings, Workers for Platforms.
Adding a binding is an architecture decision, not a convenience — write down
*why* in the same change.

**Workers AI moved IN SCOPE**, and here is the written reason. Support staff
answer the same questions repeatedly, and a draft they edit is faster than a
reply they compose; drafting is also the safest possible first AI surface,
because a human reads every word before a merchant does. Workers AI rather than
a hosted provider because it is a BINDING: no API key to store, rotate or leak,
no egress, and it bills on the same account as everything else. The AI SDK
(`ai` + `workers-ai-provider`) sits behind our own port, so swapping to a hosted
model later is an adapter change and nothing above it moves.

The constraints that come with it:

- **No model id is ever hardcoded in a feature.** A caller names a ROLE
  (`writing`, `summary`); which model serves that role is a row in `ai_models`,
  chosen from a catalogue in the internal console. A typo'd or retired id
  resolves to nothing at call time, which reads as a broken feature rather than
  a bad setting — hence a select, never a text field.
- **Every call is metered.** One `ai_runs` row per call, with tokens and
  latency, because tokens are what cost money and an unmetered AI surface is an
  unbounded bill.
- **AI is decoration, never correctness.** A failed or absent model degrades the
  feature to "no draft"; it must never block a reply being sent
  (@rules/data.md).

Two calls that recur and deserve a recorded answer rather than a reflex:

- **Queues vs Workflows.** Queues fit enqueue-and-forget single steps.
  **Workflows** fit multi-step processes where each step must survive failure
  independently. Pick per pipeline, and say which and why.
- **R2** only once blobs actually exist. Nothing needs it by default.

## Limits that change the design

- **128 MB per isolate** → stream bodies (`response.body`, `TransformStream`);
  never `await response.text()` on unbounded data.
- **CPU 30s default** (raisable), **15 min wall** for queue/cron consumers, but
  **`waitUntil` only ~30s** → long work belongs in a Queue, never in
  `waitUntil`.
- **Subrequests are capped per invocation, and only ~6 connections may wait on
  headers at once** → never one Shopify or D1 call per row. Batch, or move the
  fan-out into a consumer.
- **10 MB compressed script** → no bundling a library you use one function of.

## Config

- **`wrangler.jsonc`**, not TOML — newer platform features are JSON-only.
- `compatibility_date` current, `nodejs_compat` enabled (AsyncLocalStorage for
  the request context).
- **`wrangler types` generates `Env`. Never hand-write a binding interface** — it
  drifts from config silently.
- **Named-env bindings are NOT inherited.** Every binding, `var`, trigger, and
  observability block is re-declared under the production env. A forgotten one is
  *absent* in production, not inherited. `main`, `compatibility_date`,
  `compatibility_flags` and `assets` are the exceptions that DO inherit.
- **A placeholder id must never survive into a deployed env.** The top-level
  config is local dev (Miniflare simulates bindings by name and ignores ids), so
  those ids are deliberately fake. Check the real ones are in the production env
  before deploying.
- Secrets via `wrangler secret put` / Secrets Store, **never** in config or
  source. Public config (domains, scopes, client id) lives in `vars`, committed on
  purpose, so a domain move is a config edit and nothing in `app/` holds a
  hostname.
- `custom_domain: true` when the Worker is the origin.

## Runtime invariants

- **Bindings, never the Cloudflare REST API** from inside a Worker.
- **Never destructure `ctx`** (`const { waitUntil } = ctx`) — it loses `this` and
  throws *Illegal invocation* at runtime.
- **No floating promises.** Every promise is awaited, returned, or handed to
  `ctx.waitUntil()`. `@typescript-eslint/no-floating-promises` is the gate.
- **No module-level mutable state** — an isolate is reused across shops
  (`@rules/architecture.md`).
- **`env` / `getEnv()`, never `process.env`** — workerd does not populate it.
- All three surfaces — `fetch`, `queue`, `scheduled` — wrap work in the request
  context so `getDb()`/`getEnv()` resolve.
- **`crypto.getRandomValues()` / `crypto.randomUUID()`, never `Math.random()`**
  for anything security-bearing. Compare Shopify webhook HMACs with
  `crypto.subtle.timingSafeEqual` — never `===`.
- **No `passThroughOnException`.** Explicit `try/catch` and a structured error
  response.

## Deploy

`npm run cf:deploy` is the whole path: **verify → production build → D1
migrations → deploy**, in that order. Migrations land *before* the worker, so
code never runs ahead of its schema.

**Build and deploy are one command on purpose. Never split them.**
`@cloudflare/vite-plugin` resolves the environment at **build** time and bakes it
into `build/server/wrangler.json`. `CLOUDFLARE_ENV=production` during the build
is what selects the production env — `wrangler deploy --env production` on a dev
build silently ignores the flag and ships localhost vars with placeholder
binding ids. This is a real, reproducible failure, not a theoretical one.

**npm is the only package manager.** A CI builder picks its installer from the
lockfiles it finds, so a stray `yarn.lock` or `pnpm-lock.yaml` silently changes
the build.

**Migration filenames are the applied key** (`d1_migrations` records them by
name). Never rename or renumber an applied migration; forward-only, always.
