---
description: Strict TDD — red→green→refactor with a watched failure every time, real behavior over mocks, no test ever touching a real external service. Apply when writing or changing any test, or any production code that needs one.
globs:
  - "app/test/**/*.ts"
  - "app/**/*.test.{ts,tsx}"
  - "app/**/__tests__/**"
  - "app/**/*.ts"
  - "app/**/*.tsx"
alwaysApply: true
---

# Testing — strict TDD

This file is the authoritative version of the TDD contract summarized in
`.claude/CLAUDE.md`. It is not advisory.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote production code before its test? **Delete it and start over test-first.**
Not "keep it as reference", not "adapt it while writing the test", not "look at
it once". Delete means delete — code you kept will bias the test into describing
what you built instead of what was required.

**A test that has never failed is not evidence.** It might assert the wrong
thing, assert the implementation rather than the behavior, or pass for a reason
unrelated to the feature. The watched failure is the only proof the test is
wired to the behavior at all.

**Violating the letter of this rule is violating its spirit.**

## Before writing implementation code

If a dedicated TDD skill is installed (for example
`superpowers:test-driven-development`), invoke it — it carries the full cycle,
good/bad test examples, and the rebuttals to every rationalization. This file is
the repo layer on top; where they differ, **the stricter reading wins**. If no
such skill is available, this file alone is the contract.

## The loop — every behavior change, no exceptions

1. **RED** — write ONE small test naming the behavior. One thing per test; an
   "and" in the test name means split it.
2. **Verify RED — MANDATORY.** Run it. Confirm it *fails*, and fails for the
   RIGHT reason (feature missing), not from a typo, bad import, or missing
   fixture. Passed immediately? You are testing existing behavior — fix the
   test. Errored? Fix the error and re-run until it fails cleanly.
3. **GREEN** — the minimal code to pass. No speculative options, no config
   objects "for later", no adjacent refactors. YAGNI.
4. **Verify GREEN — MANDATORY.** Run it. It passes, neighboring tests still
   pass, and the output is pristine — no stray errors or warnings. Test still
   failing? Fix the code, never the assertion.
5. **REFACTOR** — only once green. Remove duplication, improve names, extract
   helpers. Stay green. Add no behavior.

You must be able to state, for any behavior you shipped, what the failure
message said before you implemented it. If you cannot, you did not do this.

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
| **Routes / UI** | TDD the server side — loaders, actions, intent handlers, payload builders. Polaris web components cannot be meaningfully unit-tested; verify those by hand and **say so honestly**. Never fake UI coverage by mocking the component tree. |

## A bug fix STARTS with a failing test

Reproduce the bug in a test, watch it fail, then fix it. The test is what proves
the fix and what stops the regression. Never fix a bug without one.

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
- **The guard has its own test** (`app/outbound-guard.test.ts`), and it must be
  watched failing with the guard removed. A guard you have never seen fail is
  not a guard.

## Real behavior, not mocks

- Mock **only the outermost external HTTP boundary** — Shopify Admin GraphQL,
  email. Everything below it (D1, KV, Queues, your own decisions and arithmetic)
  runs for real.
- **Never mock a model or service to assert call-args.** A test whose only
  assertion is `expect(mock).toHaveBeenCalledWith(...)` tests the
  implementation: it fails on a correct refactor and passes when the behavior
  breaks. Assert resulting **DB state** instead.
- Forbidden: a test that fails only when you remove a mock; a partial mock
  missing fields the real API returns; test-only methods added to production
  code (helpers live in `app/test/`).
- Hard to test → the design is wrong, not the rule. Must mock everything → too
  coupled; inject dependencies. Huge setup → extract factories into
  `app/test/`.

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

- [ ] Every new function has a test that **failed first**
- [ ] Each failure was for the expected reason, and I can state the message
- [ ] Minimal code written to pass each one
- [ ] All relevant tests pass; output pristine
- [ ] Real code exercised; mocks only at the external HTTP boundary
- [ ] Edge cases: zero, negative, boundary, missing data, duplicate/replay, unauthorized
- [ ] Ran the commands above and reported the real result

Can't check every box? You skipped TDD. Start over.

## Rationalizations — all rejected

| Excuse | Reality |
|---|---|
| "Too simple to test" | Simple code breaks. The test takes 30 seconds. |
| "I'll write tests after" | Tests written after pass immediately, and prove nothing. |
| "Tests-after achieve the same goal" | Tests-after ask "what does this do?" Tests-first ask "what *should* it do?" |
| "I already tested it manually" | Ad-hoc ≠ systematic. No record, can't re-run, forgotten under pressure. |
| "Deleting hours of work is wasteful" | Sunk cost. Keeping code you can't trust is the actual debt. |
| "Keep it as reference while I write the test" | You will adapt it. That is testing after. Delete it. |
| "I need to explore first" | Fine — throw the spike away, then start with TDD. |
| "TDD is dogmatic, I'm being pragmatic" | TDD *is* the pragmatic path. Debugging production is the slow one. |
| "This case is different because…" | It isn't. |

Only a human partner can waive this, explicitly, for a named piece of work.
Throwaway spikes, generated code, and config files are the sole candidates —
ask, don't assume.
