# Phase 2 Report

Files: `app/models/shopify-events.server.ts`, `app/models/shops.server.ts`, `app/models/shop-subscriptions.server.ts`, `app/models/shop-sync-checkpoints.server.ts`, and colocated tests.

Implemented Partner relationship/subscription ledger writes, ordered projections, atomic item replacement via D1 batch, tenant-scoped reads, and checkpoint read/success/failure persistence with bounded failure detail. Existing lifecycle schema already contained required tables; `npm run db:generate` reported no schema changes, so no migration was generated.

Tests: `npx vitest run app/models/shopify-events.test.ts app/models/shops.test.ts app/models/shop-subscriptions.test.ts app/models/shop-sync-checkpoints.test.ts` (17 passed); `npm run typecheck`; `npm run lint`.

Concerns: projection and ledger writes are separate D1 operations after ledger insert; duplicate IDs never invoke projection. Full transaction orchestration remains for reconciliation phase.
