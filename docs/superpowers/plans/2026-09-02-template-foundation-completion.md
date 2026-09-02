# Template Foundation Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish reusable lifecycle template seams without inventing merchant-specific production values.

**Architecture:** Move all service-to-model dependencies behind narrow injected ports, assembled only in `app/wiring.server.ts`. Test webhook and tenant safety against real local D1/KV/R2 bindings. Keep production identity inputs explicit blockers.

**Tech Stack:** React Router, TypeScript, Vitest Cloudflare pool, Drizzle/D1, KV, R2, Queues, Shopify Polaris.

**Spec:** `docs/LIFECYCLE_FOUNDATION_STATUS.md`

## Global Constraints

- TDD: observe focused RED before minimum production change, then GREEN.
- No `any`, `as`, skipped tests, new dependency, mocked D1/KV/R2, or fabricated production value.
- Services import ports only. Models own Drizzle. `app/wiring.server.ts` builds per-request adapters.
- Shopify UI/API work uses matching Shopify skill lookup and validator.
- Embedded `/app` uses Polaris and translations. `/internal` migration requires owner decision first.

---

## File Map

- `app/ports/*.ts`: narrow dependencies for remaining services.
- `app/services/*.server.ts`: use cases consume ports, never models/adapters.
- `app/wiring.server.ts`: composition root.
- `workers/app.ts`, `workers/app.queue.test.ts`: queue entry behavior.
- `app/services/compliance-support.test.ts`: D1/KV/R2 tenant isolation.
- `scripts/install-skills.mjs`, `scripts/install-skills.test.mjs`: isolated locked installer.
- `docs/LIFECYCLE_FOUNDATION_STATUS.md`: completed work and real blockers.

### Task 1: Queue Worker Boundary

**Files:** modify `app/services/webhook-queue.ts`, `workers/app.ts`; create `workers/app.queue.test.ts`.

**Produces:** `handleWebhookQueueBatch(batch, dependencies): Promise<void>`; worker entry only wires dependencies and dispatches.

- [ ] Write failing tests for missing/redacted delivery ack with zero handler writes and attempt-eight failure retry plus dead-letter persistence.
- [ ] Run `npx vitest run workers/app.queue.test.ts`; observe missing export failure.
- [ ] Extract batch loop from `workers/app.ts`; preserve `processQueuedWebhookMessage` per-message behavior. Hash shop SHA-256 before logging. Log only ID, hash, topic, handler, outcome, attempts, latency.
- [ ] Run `npx vitest run app/services/webhook-consumer.test.ts app/services/webhook-queue.test.ts workers/app.queue.test.ts`; expect pass.
- [ ] Commit: `git commit -m "test: cover webhook queue worker boundary"`.

### Task 2: Full Tenant Resource Erasure

**Files:** modify `app/models/tenant-purge.test.ts`, `app/services/compliance-support.test.ts`, `app/session-storage.test.ts`.

**Produces:** two-tenant proof for every D1 shop table, R2 attachment object, and KV session.

- [ ] Write failing test that stores target and other-tenant R2 objects and KV sessions, runs `purgeTenant(deps, targetShop)`, and asserts target missing while other tenant remains.
- [ ] Run `npx vitest run app/services/compliance-support.test.ts`; observe fixture/proof failure.
- [ ] Seed through `TenantPurgeRepo`, `KVSessionStorage`, and `env.UPLOADS`; do not fake persistence. Assert global `shopify_sync_checkpoints` remains because it has no tenant key.
- [ ] Run `npx vitest run app/models/tenant-purge.test.ts app/services/compliance.test.ts app/services/compliance-support.test.ts app/session-storage.test.ts`; expect pass.
- [ ] Commit: `git commit -m "test: prove tenant purge resource isolation"`.

### Task 3: Admin Identity Ports

**Files:** create `app/ports/admin-users.ts`, `app/ports/password-reset-tokens.ts`; modify `app/services/admin-auth.server.ts`, `app/services/admin-management.server.ts`, `app/services/password-reset.server.ts`, `app/wiring.server.ts`, adjacent tests.

**Produces:** `AdminUserPort` and `PasswordResetTokenPort`; services receive dependency objects.

- [ ] Write failing service test passing an in-memory `AdminUserPort` to credential verification and asserting login record call.
- [ ] Run `npx vitest run app/services/admin-auth.test.ts`; observe dependency signature failure.
- [ ] Define only used port methods: user lookup/update/create/status/role/remove/count; token create/find/count/spend/invalidate/cleanup. Bind existing repos in wiring. Do not use service default constructors that create models.
- [ ] Run `npx vitest run app/services/admin-auth.test.ts app/services/admin-management.test.ts app/services/password-reset.test.ts && npm run typecheck`; expect pass.
- [ ] Verify `rg '^import .*~/models' app/services/admin-auth.server.ts app/services/admin-management.server.ts app/services/password-reset.server.ts` returns no lines. Commit `refactor: inject admin identity ports`.

### Task 4: AI, Support, Webhook Ingest, Scheduled Ports

**Files:** create `app/ports/ai-repository.ts`, `app/ports/support.ts`, `app/ports/webhook-deliveries.ts`, `app/ports/scheduled.ts`; modify `app/services/ai.server.ts`, `app/services/support.server.ts`, `app/services/webhook-ingest.ts`, `app/services/scheduled.server.ts`, `app/wiring.server.ts`, adjacent tests.

**Produces:** immutable dependencies for repository ports, clock, queue, notifier, Partner API, checkpoints, and ledger.

- [ ] Write one failing test per service proving injected repository/client used, e.g. `runScheduledSweeps(100, { tokens, history: { reconcile } })` calls `reconcile`.
- [ ] Run focused service tests; observe missing dependency injection.
- [ ] Replace each direct model/adapter import with smallest port. Keep ports separate by use case; do not create mega repository. Bind current implementations in wiring.
- [ ] Run `npx vitest run app/services/ai.test.ts app/services/support.test.ts app/services/webhook-ingest.test.ts app/services/scheduled.test.ts` and `rg '^import .*~/(models|adapters)' app/services --glob '!*.test.ts'`; expect tests pass and search empty.
- [ ] Commit: `git commit -m "refactor: complete service port boundaries"`.

### Task 5: Locked Installer Isolation

**Files:** modify `scripts/install-skills.mjs`, `scripts/setup-agents.contract.mjs`, `package.json`; create `scripts/install-skills.test.mjs`.

**Produces:** test-only explicit destination flags, byte-stable lockfile verification.

- [ ] Write failing Node test using temporary `--claude-dir` and `--codex-dir`; assert installs land there and `skills-lock.json` bytes stay identical.
- [ ] Run `node scripts/install-skills.test.mjs`; observe flags absent or host-directory writes.
- [ ] Add validated `--claude-dir`/`--codex-dir`; require paths under supplied temporary root. In locked mode compare lockfile bytes after installation and fail if altered; never silently restore mutation.
- [ ] Run `node scripts/install-skills.test.mjs && npm run test:agent-setup`; expect pass.
- [ ] Commit: `git commit -m "test: isolate locked agent setup"`.

### Task 6: Internal UI Decision and Migration

**Files:** modify `docs/LIFECYCLE_FOUNDATION_STATUS.md`; conditional changes under `app/routes/internal/**`, `app/internal/components/**`, `app/styles/internal/**`.

- [ ] Record decision request: staff-only `/internal` keeps current accessible UI system, or migrates to Polaris despite not being embedded Admin.
- [ ] Do not migrate without this decision.
- [ ] If Polaris selected: invoke `shopify-polaris-app-home`, search Homepage/Index/Details/Settings templates, inspect installed custom-elements manifest, validate all markup.
- [ ] Migrate groups test-first: auth; dashboard; shops/subscriptions; support; admins/profile/AI. For every group add translation/render assertions, run focused tests, then commit separately.
- [ ] Final migration gate: `npm run verify && npm run build`; no Tailwind/ngk imports in migrated files.

### Task 7: Final Gate and Status

**Files:** modify `docs/LIFECYCLE_FOUNDATION_STATUS.md`.

- [ ] Run `npm run verify`, `npm run db:migrate:local`, `npm run test:agent-setup`, `npm run build`, and `git diff --check`; each must exit zero.
- [ ] Run `npm run check:placeholders`; expect failure until derived app supplies values. Never weaken guard.
- [ ] With authorized Shopify org/app linkage, run skill-documented dev and production CLI validation. Record exact failures if access still blocked.
- [ ] Update status only with observed verification. Keep client ID, app URL, resource IDs, Partner credentials, plan handles, legal identity/copy, callback/scopes, and Shopify org access as external inputs.
- [ ] Commit: `git commit -m "docs: record template foundation verification"`.

## Coverage Check

- Queue safety: Task 1.
- D1/KV/R2 tenant isolation: Task 2.
- Inward architecture: Tasks 3 and 4.
- Locked installer integrity: Task 5.
- Internal UI: Task 6 requires owner decision.
- Production authority and values: Task 7 external gate.
