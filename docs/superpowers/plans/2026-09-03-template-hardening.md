# Template Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Shopify/Cloudflare starter safe to clone by fixing API version drift, upload authorization, transactional support writes, KV scaling, compliance scoping, cleanup, and local billing hazards.

**Architecture:** Preserve the existing ports/adapters/core boundaries. Add a shop-scoped pending-upload adapter and make support message plus attachment adoption one D1 batch; keep R2 deletion outside D1 but before destructive row deletion. Use only the per-shop KV index and bounded cron cleanup.

**Tech Stack:** React Router 7, Shopify App React Router v2, Shopify Admin/Partner GraphQL, Cloudflare Workers, D1/Drizzle, KV, R2, Queues, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-03-template-hardening-design.md`

## Global Constraints

- Current stable Shopify version is `2026-07`; runtime, TOML, and Partner declarations must agree.
- No client-supplied R2 key or attachment metadata is authoritative.
- Every shop-scoped read/write includes the shop as the first explicit model argument.
- Every behavior change starts with a failing test and observes RED before implementation.
- Local development must not send real email or invoke billable AI by default.
- Migrations are forward-only; generate a new Drizzle migration.

### Task 1: Version And Config Contract

**Files:**
- Modify: `app/shopify.server.ts`, `shopify.app.toml`, `shopify.app.dev.toml`, `wrangler.jsonc`, `scripts/check-placeholders.mjs`
- Test: `app/shopify.server.test.ts`, `scripts/check-placeholders.test.mjs`

- [ ] Write failing tests asserting runtime/TOML/Partner versions are `2026-07`, and local email/AI bindings are non-remote.
- [ ] Run focused tests and verify they fail on the current `2026-10`/remote configuration.
- [ ] Update declarations and preflight validation.
- [ ] Run focused tests, typecheck, and config parsing.

### Task 2: Pending Upload Ownership Schema And Adapter

**Files:**
- Modify: `app/db/schema/support.ts`, `app/db/schema.ts`, `app/models/support.server.ts`, `app/ports/support.ts`
- Create: `drizzle/0014_pending_uploads.sql`
- Test: `app/models/support.test.ts`, `app/support/attachment.test.ts`

- [ ] Add failing tests for staging, shop mismatch, expiry, duplicate adoption, and server-owned metadata.
- [ ] Verify RED.
- [ ] Add `pending_uploads` with upload id, shop, optional ticket id, R2 key, metadata, timestamps, expiry, and adopted timestamp; add repository methods that claim by shop and id.
- [ ] Verify GREEN and migration application.

### Task 3: Secure Upload And Transactional Adoption

**Files:**
- Modify: `app/routes/resources/support-upload.tsx`, `app/routes/app/support/new.tsx`, `app/routes/app/support/detail.tsx`, `app/routes/internal/support/detail.tsx`, `app/services/support.server.ts`, `app/models/support.server.ts`
- Test: `app/routes/resources/support-file.test.ts`, `app/services/support.test.ts`, route tests for new/reply upload adoption

- [ ] Write failing tests proving tampered hidden metadata and foreign upload ids cannot be adopted or downloaded.
- [ ] Verify RED.
- [ ] Make upload route stage metadata server-side; submit only ids; claim and adopt pending rows in the same D1 batch as message writes; validate ticket ownership and expiry.
- [ ] Verify GREEN, including no partial rows on failure.

### Task 4: Remove Global KV Scans And Add Cleanup

**Files:**
- Modify: `app/session-storage.server.ts`, `app/wiring.server.ts`, `app/services/scheduled.server.ts`, `app/ports/scheduled.ts`
- Test: `app/session-storage.test.ts`, `app/services/scheduled.test.ts`

- [ ] Write failing tests proving shop lookup never lists `session:` and expired pending uploads are cleaned in bounded batches.
- [ ] Verify RED.
- [ ] Remove global fallback listing; add pending-upload cleanup port and scheduled sweep with R2-before-D1 ordering.
- [ ] Verify GREEN and ensure each cron sweep remains independently guarded.

### Task 5: Compliance Correctness

**Files:**
- Modify: `app/services/compliance.server.ts`, `app/routes/webhooks/compliance.tsx`, `app/models/tenant-purge.server.ts`, `app/services/tenant-purge.server.ts`
- Test: `app/services/compliance.test.ts`, `app/services/compliance-support.test.ts`, `app/routes/webhooks/compliance.test.ts`

- [ ] Write failing tests for authenticated-shop mismatch, pending-upload purge, and explicit no-customer-data outcomes.
- [ ] Verify RED.
- [ ] Use authenticated shop as the destructive tenant authority, include pending uploads in purge, and make no-data status explicit without claiming generic future compliance implementation.
- [ ] Verify GREEN and migration coverage.

### Task 6: Full Verification And Documentation

**Files:**
- Modify: `docs/LEGAL_TEMPLATE.md`, relevant README/setup docs, generated types if needed

- [ ] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, migration tests, Partner schema validation, and `npm run check:placeholders production`.
- [ ] Fix genuine failures without weakening tests or guards.
- [ ] Re-run every command and record exact results.
