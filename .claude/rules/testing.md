---
description: Testing guidance — real behavior over mocks, no test ever touching a real external service. Apply when writing or changing any test, or any production code that needs one.
globs:
  - "app/test/**/*.ts"
  - "app/**/*.test.{ts,tsx}"
  - "app/**/__tests__/**"
  - "app/**/*.ts"
  - "app/**/*.tsx"
alwaysApply: true
---

# Testing

Use evidence before claiming anything is done, fixed, or passing, and isolate the
root cause before changing code for a bug or test failure.

## Test shape by layer

The pure core is unit-tested exhaustively; anything crossing a boundary gets an
integration test against **real local bindings**. Match the layer, not the file.

| Layer | Test shape |
|---|---|
| **Pure core** (`app/domain/`, `app/lib/`) | No I/O → exhaustive unit tests. Every branch, every variant of a union, and the unknown/retired variant. Free to run, so there is no excuse for a gap. |
| **Money and any arithmetic on it** | Integer minor units only. Cover zero, negative, rounding and cent boundaries, currency mismatch. A float appearing anywhere is a bug. |
| **Models** (`app/models/`) | Integration against real local D1. Every query shop-scoped, and **a test proving a query cannot read another shop's row is required, not optional**. |
| **Use cases** (`app/services/`) | Decisions tested with fake ports — no D1, no network. If a use case needs real bindings to test, a decision leaked into the wrong ring. |
| **Webhook and queue consumers** | Integration. Always include a **duplicate-delivery test proving exactly one effect** — deliveries are at-least-once, so the replay test ships with the handler, not as a follow-up ticket. |
| **Session storage / KV adapters** | Integration against real local KV. Cover expiry, absence, and the oversized-payload fallback. |
| **Routes / UI** | Test the server side — loaders, actions, intent handlers, payload builders. Polaris web components cannot be meaningfully unit-tested; verify those by hand and **say so honestly**. Never fake UI coverage by mocking the component tree. |

## A test must NEVER call a real external service

Not a style preference — this has really happened. A suite that inherited live
email credentials quietly mailed a non-existent address for weeks: hundreds of
sends, an 86% bounce rate inside 24 hours, the sending domain's reputation
degraded and its daily quota exhausted. **Every test was green the whole time.**
Green is not proof of harmlessness.

So, in this repo:

- **Outbound network is blocked in `vitest.config.ts`** via the pool's
  `outboundService`, and third-party credentials are blanked or faked in the test
  env. A blocked-outbound error is **the guard working** — the fix is a fake at
  the outermost HTTP boundary, never an exception to the guard.
- Bindings — **D1, KV, R2, Queues** — are local emulations. Use them for real;
  that is the point of the Workers pool. Only the public internet is closed.
- If a test ever needs a recipient address, use a domain you own. Never
  `@example.com`, `.test`, `.invalid`, or `.localhost` (RFC-2606 reserved → hard
  bounce), and never a stranger's real inbox.
- **The guard has its own test** (`app/outbound-guard.test.ts`) to verify that
  outbound requests are blocked.

## Real behavior, not mocks

- Mock **only the outermost external HTTP boundary** — Shopify Admin GraphQL,
  email. Everything below it (D1, KV, Queues, your own decisions and arithmetic)
  runs for real.
- **Never mock a model or service to assert call-args.** A test whose only
  assertion is `expect(mock).toHaveBeenCalledWith(...)` tests the
  implementation: it fails on a correct refactor and passes when the behavior
  breaks. Assert resulting **DB state** instead.
- UI assertions must connect values to their semantic label, accessible name,
  or containing region. A global substring match for a number can pass when the
  intended metric is wrong because the same digits appear elsewhere in markup.
- Forbidden: a test that fails only when you remove a mock; a partial mock
  missing fields the real API returns; test-only methods added to production
  code (helpers live in `app/test/`).
- Hard to test → the design is wrong, not the rule. Must mock everything → too
  coupled; inject dependencies. Huge setup → extract factories into
  `app/test/`.

## Speed, and what it costs

The Workers project runs with `isolate: false`: files share one workerd runtime,
so the dependency graph is imported once instead of once per file (the full
suite went from ~165s to ~95s). Tests boot `app/test/worker-entry.ts`, a stub,
not `workers/app.ts`, which would load the whole app into every runtime.

The trade-off is that **KV, R2 and in-memory binding state is not reset between
files**. A test must not rely on, or be broken by, another file's leftovers: use
unique keys per test, reset D1 with `setupTestDatabase()` (one batched delete per
test), and keep module-level mutable state out of production code (already
banned). Run `npx vitest run --sequence.shuffle.files` after adding a test that
touches KV, R2 or a rate limiter. For the inner loop, `npm run test:quick` runs
only the tests affected by uncommitted changes.

## Before claiming done

Run it and read the output. Then say what you ran.

```bash
npx vitest related --run <changed files>
npm run verify                      # typecheck + lint + full suite
```

`related` is a **subcommand, not a flag** — `--related` was removed in Vitest 4
and dies with `CACError` before a single test runs. Run the **full** suite
(`npm run verify`) when the change touches `app/db/`, `drizzle/`, money, a
webhook handler, the Shopify seam, or any build config — a migration breaks tests
that never mention it.

Never `--no-verify`. Never `.skip` a test to move on. Never weaken an assertion,
delete a check, or narrow scope silently to reach green.

### Checklist

- [ ] All relevant tests pass; output pristine
- [ ] Real code exercised; mocks only at the external HTTP boundary
- [ ] Edge cases: zero, negative, boundary, missing data, duplicate/replay, unauthorized
- [ ] Ran the commands above and reported the real result
