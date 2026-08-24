---
description: Clean code at the statement level — types that make wrong states unrepresentable, parse at the edge, Result over throw, purity, naming, immutability, logging. Apply when writing or editing any function.
globs:
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "workers/**/*.ts"
  - "extensions/**/*.{ts,tsx}"
alwaysApply: true
---

# Code craft

Same law as `@rules/architecture.md`, at the statement level: keep the core
clean, push mess to the edge.

## Types make wrong states unrepresentable

- **No `any`, no `as`, no `@ts-ignore`, no non-null `!`.** If the types resist,
  the design is wrong — fix the design.
- **Brand every id and amount.** `ShopDomain`, `OrderId`, `MinorUnits`,
  `CurrencyCode`. Two `string` ids that can be swapped at a call site will be
  swapped. Money is **integer minor units + currency, always together** — a float
  anywhere is a bug, and `~/money` is the only way to make one
  (@rules/money.md).
- **Unions over booleans + optionals.** Model a status as
  `"pending" | "active" | "cancelled"`, never three nullable boolean fields.
  Switch exhaustively with a `never` fallthrough so adding a variant fails the
  build.
- Types are derived, not duplicated: infer from the Zod schema or the Drizzle
  table, never hand-write a parallel interface.

## Parse at the edge, trust inside

Every external input — form data, webhook body, query params, GraphQL response,
env — is parsed by a Zod schema **at ring 5**. Inward of that boundary, values
are already valid: no re-checking, no defensive `if (!x) return`.

Unvalidated data must never reach a use case. Persisting a field the merchant
did not submit through an explicit **allowlist** is the same rule: a forged
request must not be able to write a gated column.

## Failure is a value, not an exception

- Expected failures return `Result<T, E>` from `app/lib/result.ts` — validation,
  a rejected mutation, a missing record.
- `throw` is reserved for programmer error and broken invariants.
- **Never `catch {}`.** A caught error is recorded, logged, and returned as a
  reason, or it is re-thrown. Never return a success shape for an effect that
  did not happen.

## Purity is enforced by signature

Time, randomness, ids, and env are **parameters**, never ambient reads.
`Date.now()`, `crypto.randomUUID()`, and `process.env` do not appear in rings
1–4. This is what makes the core deterministic and the tests real.

## Functions have one job

Split when: you need **"and"** to describe it · it mixes parse + decide + I/O ·
nesting depth > 2 · **more than 3 branches choosing different outcomes** (that is
a registry — see `@rules/design-patterns.md`) · a block needs a comment saying
"this part does X".

An orchestrator reads as named steps and **never inlines a step's body**. Derive
a value once and pass it down; the same derivation must never exist in two
places. A `.map()` callback is a thin projection — field reads plus calls to pure
helpers, no logic.

Build response objects **explicitly**. Never spread a DB row into a response
(columns leak), never spread-then-strip to drop a field.

More than ~4 positional params → one options object. No speculative parameters.

## Naming

One word per concept, **identical across DB column, model, use case, schema,
payload, and UI label**. If the table says `shop`, nothing downstream calls it
`storeDomain`. Never rename a concept in transit.

Functions are verbs (`recordInstall`, `syncOrder`). Banned suffixes: `Manager`,
`Helper`, `Util`, `Data`, `Info`, `Service` on anything that is not a ring-3 use
case. Booleans read as predicates (`isExpired`, `hasActivePlan`).

## Immutability

Inputs are `readonly`; never mutate a parameter, a loop accumulator you did not
create, or a shared object. Return new values.

## Observability

Every degraded path and every failed side effect logs a **structured event** with
a stable name and the shop — never a bare string, never a swallowed failure.
Never log secrets, tokens, or customer PII.
