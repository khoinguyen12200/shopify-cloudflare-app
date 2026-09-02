# Shopify Lifecycle Foundation Status

Status date: 2026-09-02

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
- Subscription item replacement with atomic D1 writes.
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
- Active subscription refresh after OAuth and embedded app access.
- Null active subscription projects `NONE`.
- Reconciliation failures do not silently become free subscriptions.

### Webhooks and queues

- HMAC-authenticated uninstall and scope-update webhooks.
- Durable webhook inbox.
- Queue handoff after inbox persistence.
- Idempotent delivery claiming and processing.
- Retry handling and persisted dead-letter status.
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
- Explicit `implemented: true` and `noCustomerData: true` outcomes for customer
  compliance topics while app stores no customer records.
- Shop-redaction path uses dependency ports instead of service-level model access.

### Internal operations

- Dashboard reads current projections for billing totals.
- Operational health read model exposes webhook failures, dead-letter count,
  lifecycle event count, subscription event count, and last sync checkpoint.
- Internal subscription/shop/support readers use normalized projections/history.

### Agent setup and launch safety

- `AGENTS.md` is source of truth; `CLAUDE.md` points to it.
- `npm install` runs agent setup.
- Locked skills install for Claude Code and Codex.
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

### Tenant purge

- Full two-tenant fixture still needs rows for every supported table family,
  including checkpoints and all notification variants.

### Internal operations UI

- Shop list/detail, subscription, and support pages need the same checkpoint,
  webhook/DLQ, relationship, subscription, cancellation, paid-status, and MRR
  presentation.
- Newly added dashboard health copy needs translation keys and Polaris-compliant
  rendering instead of hardcoded English/utility styling.

### Architecture cleanup

- Several existing services still import model adapters directly. They need ports
  and one wiring boundary to satisfy the inward dependency rule completely.
- Remaining `Promise<unknown>` port returns should become concrete result types.

### Launch validation

- Disposable isolated `HOME`/`CODEX_HOME` setup tests are not complete.
- Shopify config validation is externally blocked:
  - production requires non-interactive app linking/client ID;
  - dev returned HTTP `403`, “You are not a member of the requested organization”.
- Production placeholder check intentionally fails until each new app fills real
  IDs, URLs, legal identity, support/privacy/pricing copy, and plan handles.

## Verification Evidence

Latest verified commands:

```text
npm run verify                 typecheck + lint + 832 Vitest tests passed
npm run db:migrate:local       no migrations pending
npm run test:agent-setup       6/6 passed
npm run install:skill -- --wait --locked
                              48 locked skills verified for Claude Code and Codex
npm run build                  passed
git diff --check               passed
```

Latest local commits: `4ad0f2c`, `6c99ab2`, `99fb0a3`, `47ac8f0`

Local `HEAD` matches `origin/main`; working tree clean at time of writing.

## Intentional Template Blockers

These are not fabricated in base template. Replace them in each derived app:

- Shopify production client ID and application URL.
- Cloudflare D1, KV, queue, and R2 resource IDs/names.
- Shopify Partner app ID and API token secret.
- Managed Pricing plan handles and customer-facing plan names.
- Legal entity, privacy contact, address, effective date, and public copy.
- Production callback URLs and any feature-required access scopes.
