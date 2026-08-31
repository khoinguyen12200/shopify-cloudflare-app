# Task 1: Lifecycle Domain State Machines Report

## Changed Files

- `app/domain/shop-lifecycle.ts` adds the pure relationship state machine, its
  discriminated state union, deterministic `(occurredAt, externalId)` ordering,
  transition registry, and operational-state predicate.
- `app/domain/shop-lifecycle.test.ts` exercises install, reinstall, uninstall,
  deactivate, reactivate, duplicate/stale events, both timestamp-tie ordering
  outcomes, and operational-state classification.
- `app/domain/subscription-lifecycle.ts` adds the pure subscription state
  machine, historical-event and Active Subscription transition registries,
  deterministic ordering, and paid-state predicate.
- `app/domain/subscription-lifecycle.test.ts` exercises cancellation scheduling,
  freezing, cancellation, duplicate/stale observations, both timestamp-tie
  ordering outcomes, every Active Subscription status, and paid-state
  classification.

## RED Evidence

Command:

```sh
npx vitest run app/domain/shop-lifecycle.test.ts app/domain/subscription-lifecycle.test.ts
```

Observed output before the implementation modules existed:

```text
FAIL  app/domain/shop-lifecycle.test.ts
Error: Cannot find module './shop-lifecycle'

FAIL  app/domain/subscription-lifecycle.test.ts
Error: Cannot find module './subscription-lifecycle'

Test Files  2 failed (2)
Tests  no tests
```

The suite was intentionally restarted after expanding the test contract to
exercise every Active Subscription status-map variant. The same command again
produced the same two missing-module failures before the final implementation.

## GREEN Evidence

Focused domain command:

```sh
npx vitest run app/domain/shop-lifecycle.test.ts app/domain/subscription-lifecycle.test.ts
```

Observed output:

```text
Test Files  2 passed (2)
Tests  26 passed (26)
```

Related-test command:

```sh
npx vitest related --run app/domain/shop-lifecycle.ts app/domain/shop-lifecycle.test.ts app/domain/subscription-lifecycle.ts app/domain/subscription-lifecycle.test.ts
```

Observed output:

```text
Test Files  2 passed (2)
Tests  26 passed (26)
```

Additional verification:

```sh
npm run typecheck
npm run lint
git diff --check
```

All exited with status `0`. The commit hook also re-ran `npm run typecheck` and
`npm run lint`, both with exit status `0`.

Full-suite command:

```sh
npm test
```

Observed output:

```text
Test Files  78 passed (78)
Tests  785 passed (785)
```

## Commit

- `f92c4fe feat: add lifecycle domain state machines`

## Concerns

- Vitest emits existing environment warnings about absent local Shopify/internal
  secrets and a remote AI binding. The pure domain tests make no network calls
  and still completed with exit status `0`.
- The test commands also emit the repository's existing npm warning for the
  deprecated `shamefully-hoist` configuration. It is unrelated to this slice.
- The full suite emits existing third-party sourcemap warnings. They did not
  affect the exit status or test results.
