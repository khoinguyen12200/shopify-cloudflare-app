# Shopify Lifecycle Foundation Status

Status date: 2026-09-04

## Goal

Provide reusable Shopify app foundation for Cloudflare Workers so future apps do
not need to rebuild lifecycle, billing, webhook, reconciliation, compliance,
tenant-erasure, operations, deployment, or agent-bootstrap infrastructure.

Required source-of-truth rules:

- Shopify Partner historical events are immutable business truth.
- Webhook inbox rows describe transport delivery, not billing truth.
- `shops`, subscriptions, scopes, and operational health are projections.
- Every projection is tenant-scoped, ordered, and idempotent.
- D1 access stays in models; services use ports; core logic stays framework-free.
- Money uses integer minor units plus currency.
- Claude Code and Codex receive identical project contract, skills, and Shopify MCP.
- Production deployment stops until template placeholders are replaced.

## Done

### Lifecycle and billing

- Install, uninstall, deactivate, and reactivate state machines.
- Immutable normalized Shopify event ledger.
- Ordered current relationship projections.
- Ordered current subscription projections.
- Subscription item replacement with atomic D1 writes, including a guard that
  prevents a stale duplicate from replacing a newer projection's items.
- Subscription item writes split into D1-safe statements, so projections with
  more items than one SQL statement's bind-variable limit remain valid.
- Supported subscription states: `NONE`, `PENDING`, `ACTIVE`,
  `CANCELLATION_SCHEDULED`, `FROZEN`, `CANCELED`, and `UNKNOWN`.
- Integer money and currency preservation.
- Dashboard MRR excludes non-operational shops and includes scheduled cancellation.
- Legacy billing parser, repository, schema, tests, and runtime references removed.
- Forward migration safely backfills parseable legacy rows, then drops legacy table.

### Shopify Partner reconciliation

- Cursor-paginated historical event sync.
- Fixed overlap window for late-arriving events.
- Duplicate event protection.
- Checkpoint success only after all pages finish.
- Bounded checkpoint failure metadata.
- Active subscription refresh after OAuth and the hosted-pricing return; routine
  embedded navigation reads the local D1 projection.
- Null active subscription projects `NONE`.
- Reconciliation failures do not silently become free subscriptions.
- Active subscription normalization preserves Partner identity, status, periods,
  pending update fields, pricing items, and integer minor-unit money.

### Webhooks and queues

- HMAC-authenticated uninstall and scope-update webhooks.
- Durable webhook inbox.
- Queue handoff after inbox persistence.
- Idempotent delivery claiming and processing.
- Retry handling and persisted dead-letter status.
- Queue transport logs delivery ID, hashed shop, topic/handler when known,
  outcome, attempts, and latency without raw webhook data.
- Missing inbox work, including work queued before `shop/redact`, is explicitly
  discarded and acknowledged without dispatch.
- Scope projection with granted/revoked history.
- Scope replay protection.
- Uninstall deletes stored Shopify sessions.
- Structured webhook logs record delivery ID, topic, hashed shop, handler,
  outcome, attempts, and latency without payload or token data.
- Redacted-shop queue messages acknowledge without projection writes.
- Worker-level Queue/DLQ behavior has malformed, missing, retry, redaction, and
  final-attempt dead-letter coverage.
- Compliance endpoint covers `customers/data_request`, `customers/redact`, and
  `shop/redact`.

### Compliance and tenant data

- Tenant purge orchestration deletes R2 objects before D1 rows, then KV sessions.
- D1 purge repository covers current shop-scoped tables.
- Two-tenant isolation tests.
- Purge inventory checks fail if future D1 schema tables add a `shop` column
  without coverage; D1/KV/R2 boundary tests retain another tenant's data.
- Two-tenant fixture proves every current D1 `shop` table is erased for target
  tenant while same rows for another tenant remain.
- Staged support uploads are tenant-owned: their R2 keys are collected before
  deletion and their metadata rows are erased with the rest of the tenant.
- Explicit `implemented: true` and `noCustomerData: true` outcomes for customer
  compliance topics while app stores no customer records.
- Shop-redaction path uses dependency ports instead of service-level model access.

### Internal operations

- Dashboard reads current projections for billing totals.
- Operational health read model exposes webhook failures, dead-letter count,
  lifecycle event count, subscription event count, and last sync checkpoint.
- Internal subscription/shop/support readers use normalized projections/history.
- Staff-only `/internal` keeps its current accessible UI system. Polaris App Home
  remains scoped to embedded `/app`; no `/internal` Polaris migration is planned.

### Architecture

- Admin, AI, support, webhook-ingest, scheduled, and reconciliation services use
  injected ports; Drizzle/model adapters are assembled at the wiring boundary.

### Agent setup and launch safety

- `AGENTS.md` is source of truth; `CLAUDE.md` points to it.
- `npm install` runs agent setup.
- Locked skills install for Claude Code and Codex.
- Installer tests use isolated validated destinations and protect committed
  lockfile bytes from mutation.
- Shopify MCP configured for Codex.
- 48 locked skills verified for both hosts.
- Production placeholder guard checks Cloudflare IDs, Shopify app URL/client ID,
  redirect drift, scopes, Partner app ID, plan handles, legal fields, and public
  legal/support/pricing copy.
- Legal template and required secret/deploy documentation exist.

### Partner API normalization

- Active Subscription query validated against Partner API `2026-07` schema.
- Normalized recurring pricing, discounts, usage cost, pending updates,
  trial/current-cycle fields, and legacy subscription IDs exposed through typed
  adapter results.

## Not Done

### Internal operations UI

- No migration remains. `/internal` stays on its current accessible, translated
  staff UI system.

### Launch validation

- Shopify Partner queries were searched and schema-validated against `2026-07`;
  live validation remains blocked by organization credentials.
- Shopify config validation is externally blocked:
  - production requires non-interactive app linking/client ID;
  - dev returned HTTP `403`, “You are not a member of the requested organization”.
- Local Partner API smoke test reached Shopify successfully, but Historical Events
  returned `Partner API client is missing the following permissions: [:list_events]`.
  Grant the client event-listing access before expecting D1 history reconciliation.
- Production placeholder check intentionally fails until each new app fills real
  IDs, URLs, legal identity, support/privacy/pricing copy, and plan handles.

## Verification Evidence

Latest verified commands:

```text
npm run verify                 typecheck + lint + 917 Vitest tests passed
npm run db:migrate:local       no migrations pending
npm run test:agent-setup       12/12 passed
npm run build                  passed
git diff --check               passed
npm run check:placeholders     expected failure: 10 launch contract issues
```

`npm run verify` currently reports 104 files and 917 tests passed. Shopify dev
config validation reached the Shopify API but returned HTTP 403 because the
current account is not a member of that app's organization; production remains
unlinked by design. Partner query schema validation passed; no live Partner API
success is implied.

## Intentional Template Blockers

These are not fabricated in base template. Replace them in each derived app:

- Shopify production client ID and application URL.
- Cloudflare D1, KV, queue, and R2 resource IDs/names.
- Shopify Partner organization ID, app ID, API version, and API token secret.
- Managed Pricing plan handles and customer-facing plan names.
- Legal entity, privacy contact, address, effective date, and public copy.
- Production callback URLs and any feature-required access scopes.
- Authorized Shopify organization and app access for CLI validation.
