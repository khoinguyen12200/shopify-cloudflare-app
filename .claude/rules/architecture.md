---
description: The one law — dependencies point inward at a pure core. Rings, the import matrix, what each ring may never contain, where every file goes. Apply when creating, moving, or importing any file.
globs:
  - "app/**"
  - "workers/**"
  - "extensions/**"
alwaysApply: true
---

# Architecture — the dependency rule

CLEAN means one thing here: **dependencies point inward.** The core knows
nothing about D1, Shopify, HTTP, or React. Every rule below is that law applied.

## The rings

| # | Ring | Lives in | Holds | May import |
|---|---|---|---|---|
| 1 | **Core** (pure) | `app/domain/`, `app/lib/` | Domain types, money, decision logic, state transitions, derivations | ring 1 |
| 2 | **Ports** | `app/ports/` | Interfaces the use cases need: repositories, `ShopifyAdmin`, `Clock`, `Ids`, `Mailer`, `Queue` | 1 |
| 3 | **Use cases** | `app/services/` | Orchestration: pure decisions + ports. One file per use case | 1, 2 |
| 4 | **Adapters** | `app/models/`, `app/adapters/` | Drizzle, GraphQL client, email, queue — implementations of ring 2 | 1, 2 |
| 5 | **Entry** | `app/routes/`, `workers/`, `extensions/` | Parse input → build deps → call one use case → shape output | 1–4 |

## Illegal edges — these are defects, not preferences

- **Ring 1 imports nothing with I/O.** No `getDb`, no `fetch`, no `env`, no
  `Date.now()`, no `crypto.randomUUID()`. If a core file needs one, it needs an
  argument instead.
- **Ring 3 never imports ring 4.** A use case declares a port and receives an
  implementation. It must never name a model, a GraphQL client, or Drizzle.
- **Ring 4 never imports ring 3.** Adapters are dumb; they hold no decisions.
- **Only `app/models/*.server.ts` touches Drizzle or `getDb()`.** No query
  exists anywhere else. Ever.
- **Entry points hold no logic** — parse, dispatch, respond. A loader, action,
  webhook, or worker handler with a business rule in it is misplaced code.
- Ring 5 is the **only** place adapters are wired to ports — one composition
  root (`app/wiring.server.ts`), one function, one object. Nothing else
  constructs an adapter.

The test for whether you got this right: **the core and every use case can be
tested with no D1, no network, and no framework.** If a test needs those to
exercise a decision, the decision is in the wrong ring.

## Routes are a nested tree, never a flat list

**`app/routes.ts` is explicit route config. Flat file-name routing
(`flatRoutes`) is not used, and adding it back is a regression.**

The URL structure and the file tree mirror each other:

```
/legal/privacy   →  app/routes/public/legal/privacy.tsx
/auth/login      →  app/routes/auth/login.tsx
/app             →  app/routes/app/_layout.tsx  +  app/routes/app/home.tsx
```

Never `routes/legal.privacy.tsx`, never `routes/webhooks.app.uninstalled.tsx`.
A directory of dot-separated names stops being readable at about a dozen routes,
you cannot tell a layout from a leaf, and every new file lands in the same flat
pile.

The rules:

- **One folder per surface**, and every route lives under one:
  `public/` (unauthenticated marketing, legal, support) · `app/` (embedded
  Shopify admin) · `auth/` (OAuth) · `webhooks/`. A route that fits none of them
  is a new surface — add a group in `routes.ts` and a folder for it.
- **Nest to match the URL.** A path segment is a directory. `/webhooks/app/
  uninstalled` is `webhooks/app/uninstalled.tsx`.
- **`_layout.tsx` is the shell for its folder**, and the only thing that may
  load that surface's stylesheet or run its shared auth check. The leading
  underscore is what distinguishes it from a page at a glance.
- **Route-local helpers sit beside their route**, suffixed, not hidden in a
  sibling directory: `auth/login.tsx` + `auth/login-error.server.ts`.
- **Never re-export a route from a barrel.** `routes.ts` is the only index.
- Declaring a route in `routes.ts` and creating its file are one change. A file
  with no entry is dead code; an entry with no file fails the build.

## Where files go

`app/schemas/` Zod schemas (edge parsing only) · `app/components/`
presentational Polaris only, props in / JSX out, no fetching · `scripts/` build
and tooling · tests sit beside their subject as `*.test.ts`, shared helpers in
`app/test/`.

Most of these directories do not exist yet — this table is where a file goes
when you create it, not a structure to scaffold up front.

There is no `app/utils/`. "Utils" is a junk drawer — pure helpers go to
`app/lib/<topic>.ts`, named for the topic.

## Boundaries stay closed

- A folder exposes a **same-named facade** (`services/billing.server.ts`
  re-exports `services/billing/`). Callers import the facade; internals are
  private.
- **No mutable module-level state.** A Workers isolate is reused across requests
  from different shops — a module-scope cache or `let` is a cross-tenant leak.
  Per-request state goes in the request context; caches go in KV under a
  shop-scoped key.
- No singletons, no service locators, no inheritance for reuse. Pass
  dependencies in as one object.
- Dead code is deleted, not commented out. No exported symbol without a caller.

## Caps

**700 lines per file (target 400). 60 lines per function (target 40).** Run
`wc -l` on what you grew. Growing an over-target file instead of splitting it
first is a defect. Exemptions: generated files, migration SQL, tests.

Splitting or moving is a **pure move** — output-identical, no behavior change,
tests green before and after. Never mix a move with a fix.
