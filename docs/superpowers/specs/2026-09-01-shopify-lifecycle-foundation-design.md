# Shopify Lifecycle Foundation Design

## Goal

Make this repository a reusable Shopify public-app foundation that accurately
tracks installation, access, Managed Pricing subscriptions, webhook delivery,
and privacy deletion without relying on a particular future product feature.

## Decisions

- Shopify App Pricing (Managed Pricing) is the supported billing strategy.
  The legacy Billing API webhook `app_subscriptions/update` is removed. Managed
  Pricing state and history come from the Partner API Active Subscription and
  Historical Events APIs.
- A webhook delivery inbox and a Shopify business-event ledger are separate
  records. A delivery is a technical transport attempt; a Partner event is a
  business fact. Combining them would either leak payload data into the audit
  trail or make retries indistinguishable from real changes.
- Current `shops`, granted scopes, and subscription tables are projections. They
  answer normal application queries without replaying history. The event ledger
  remains append-only and has Shopify event IDs as its idempotency keys.
- Events use Shopify's published event type names. Every supported type is
  narrowed by a static registry and validated into typed relational detail
  records. No unvalidated event JSON becomes business state.
- Reconciliation is mandatory. A daily cursor-based Partner Historical Events
  sync with a bounded overlap repairs missed/out-of-order webhook delivery;
  a per-shop Active Subscription read refreshes subscription state after billing
  redirects, authenticated access, and relevant historical events.
- Webhook routes authenticate with `authenticate.webhook()` before trusting any
  value, atomically claim a `webhookId`, enqueue only short work, and respond
  with 200 quickly. Queue consumers are independently idempotent; a DLQ retains
  failed work for operation and alerting.
- Deletion is a durable workflow. `shop/redact` removes all tenant-owned D1,
  KV, R2, and queued-work references. A minimal anonymized compliance receipt
  survives only when legally necessary; it holds no domain, payload, customer,
  or access token.

## Data Model

### Webhook delivery inbox

`webhook_deliveries` holds one row per `X-Shopify-Webhook-Id`:

- immutable identity/context: delivery ID, Shopify event ID, topic, API version,
  authenticated shop, trigger timestamp, received timestamp, payload SHA-256;
- operational state: `received`, `queued`, `processing`, `processed`, `failed`,
  `dead_letter`; attempts, processing timestamps, and bounded machine-readable
  failure information.

It intentionally does not retain raw webhook JSON. Queue messages contain only
the smallest validated payload needed by their topic and are discarded after
successful processing.

### Shopify business event ledger

`shopify_events` stores common immutable facts: Partner event ID, event type,
shop/domain IDs, occurrence and synchronization timestamps, and source
(`partner_history`, `webhook_observation`, `authenticated_access`). Partner IDs
are unique per source.

Typed child tables hold detail rather than an untyped JSON blob:

- `shopify_relationship_events`: `INSTALLED`, `UNINSTALLED`, `DEACTIVATED`,
  `REACTIVATED`, reason and reason description.
- `shopify_subscription_events`: `CREATED`, `UPDATED`,
  `CANCELLATION_SCHEDULED`, `CANCELED`, `FROZEN`, `UNFROZEN`, plan, effective
  cancellation date, and typed price information.
- Future charge, earning, and credit detail tables are added only when a feature
  needs their data. Their Shopify event types can already be ingested as opaque
  historical markers without being used for an entitlement decision.

Existing `subscription_events` is migrated to the normalized subscription-event
history when safe, then removed. It must not remain an alternative billing
truth source.

### Current projections

`shops` becomes the relationship projection:

- shop domain and Shopify shop ID;
- state: `INSTALLED`, `UNINSTALLED`, `DEACTIVATED`, `REACTIVATED`;
- first install, current install, latest status-change, last authenticated,
  last webhook, and last reconciliation timestamps;
- applied event ordering key.

`shop_subscriptions` is the current Managed Pricing projection:

- state: `NONE`, `PENDING`, `ACTIVE`, `CANCELLATION_SCHEDULED`, `FROZEN`,
  `CANCELED`, `UNKNOWN`;
- plan handle, billing period, trial and billing-cycle dates, cancellation
  effective date, and source-event ordering key.

`shop_subscription_items` normalizes the potentially multiple pricing items.
All money remains integer minor units plus currency.

`shop_granted_scopes` holds the current normalized set and
`shop_scope_changes`/`shop_scope_change_items` hold its append-only diff
history. KV is only a session cache.

`shopify_sync_checkpoints` holds the Partner-history cursor, watermark, and
last success/failure. It is app-owned operational state, not tenant data.

## State Application

All state transitions are pure functions. A projection only accepts an event
whose Shopify occurrence timestamp (then stable external ID as tie-breaker) is
newer than the projection's applied key. Duplicates and stale events leave the
projection unchanged.

An authenticated embedded request proves the app is presently installed. It
updates `lastAuthenticatedAt`; it only creates an install/reactivation
observation when moving from no active relationship. Token refreshes do not
invent reinstall history.

`app/uninstalled` immediately marks the relationship uninstalled, deletes every
shop KV session regardless of the SDK's optional `session`, and schedules
reconciliation. The next Partner History event confirms or corrects it.

Internal dashboards only treat a merchant as paid when relationship state is
installed/reactivated and its current subscription projection is active or has
a future scheduled cancellation. Uninstalled/deactivated shops are never
counted as active, paid, or MRR-producing.

## Billing and Reconciliation

The billing route continues to show the merchant Shopify's current response.
After a Managed Pricing redirect it validates the shop context and schedules an
Active Subscription refresh; it never trusts the redirect parameters as an
entitlement.

The Partner adapter uses a partner-level credential held only in a Cloudflare
secret and a configured Shopify app ID. The History synchronizer pages using a
cursor and re-reads a small time overlap, idempotently upserting by Partner event
ID. The Active Subscription adapter writes the current projection. Missing or
unavailable Partner credentials leave an observable failed sync state and never
silently label a subscription as free.

## Compliance and Tenant Erasure

`customers/data_request` and `customers/redact` have explicit no-customer-data
outcomes until a future feature stores customer data. A schema/data-inventory
test prevents a customer-identified table from being added without extending
the handlers.

`shop/redact` runs a recorded erasure job. It lists R2 attachment keys, deletes
objects before deleting relational references, purges KV sessions, then deletes
all tenant rows in one D1 transaction. Tenant-owned tables include support,
notifications, AI runs, webhook deliveries, event history, projections, scope
history, and subscription items. Consumers check the redacted relationship
before performing stale queued work.

## Infrastructure and Operations

Add a Cloudflare Queue and DLQ for webhook work, a queue handler in the Worker,
and scheduled reconciliation sweeps. Structured logs carry delivery ID, Partner
event ID, shop hash where the raw domain is unnecessary, handler, outcome, and
latency. Internal staff pages expose webhook failures/DLQ count, reconciliation
health, lifecycle history, and subscription history.

## Public-App Baseline

The base removes unused `write_products` access and declares an empty required
scope list unless a product feature explicitly needs a scope. It removes the
legacy subscription webhook and keeps the mandatory privacy topics and uninstall
and scopes-update topics.

Launch validation must fail for placeholder app URLs/client IDs, redirect URL
drift, Cloudflare resource IDs, legal contact details, and Managed Pricing plan
handles. Privacy, terms, support, and pricing pages remain required public
surfaces but use real business-provided legal copy before launch; the foundation
cannot invent legal entity details.

## Verification

Every behavior starts with a failing test. Coverage includes invalid HMAC,
delivery dedupe, delivery recovery/DLQ, no-session uninstall, duplicate and
out-of-order Partner events, reinstall versus token refresh, every relationship
and subscription transition, partner-sync pagination overlap, projection
filtering, tenant isolation, full redaction, scope diffs, stale queued work, and
configuration validation. The final gate runs typecheck, lint, all tests,
Shopify configuration validation when credentials are available, and the
production build.
