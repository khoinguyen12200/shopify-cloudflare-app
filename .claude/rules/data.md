---
description: Rules for adapters that touch D1 — shop-scoping on every query, no N+1, forward-only migrations, degrade decoration never correctness. Apply in app/models, app/db, and drizzle.
globs:
  - "app/models/**/*.ts"
  - "app/db/**/*.ts"
  - "drizzle/**"
alwaysApply: true
---

# Data access

D1 is a network hop per query and the app is multi-tenant. Both are binding.

## Shop-scoped, always

Every table carries `shop`. Every `where` includes it. Every model function takes
`shop` as its **first explicit parameter** — `findById(shop, id)`, never
`findById(id)`. An id from a form or URL is attacker-controlled.

A query that can read or write another shop's row is a **security defect**.
`@rules/testing.md` requires a test proving it cannot — part of the feature, not
a follow-up.

## Never one query per row

A query inside `.map()`, `for`, or `forEach` over rows you just fetched is a
defect. Batch with `inArray(...)` and group in memory, **preserving the query's
`ORDER BY`** so per-parent ordering matches.

Cost scales with the largest merchant, not the fixture. In production the tell is
`wallTimeMs` orders of magnitude above `cpuTimeMs` — that is round trips, not
slow code.

## Migrations are forward-only

Once applied to production, never edit, rename, or renumber a migration — a new
one fixes a bad one. Migrations are generated (`npm run db:generate`), never
hand-written, and the filename is the applied key. Adding a column is safe;
removing one is two deploys (stop reading, then drop). Any change under
`app/db/` or `drizzle/` runs the **full** suite: a migration breaks tests that
never mention it.

## Failure boundaries

Independent panels fail independently with a sensible empty value **and a logged
event** — never `catch {}`, never a blank page from one bad query.

**Degrade decoration. Never degrade correctness.** A count, a badge, or a
secondary panel may fall back to an empty value. Anything the page cannot be
correct without — an amount, a total, an entitlement, a status the merchant will
act on — fails loudly instead of rendering a plausible wrong number.
