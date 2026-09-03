# Template Hardening Design

## Goal

Make the Shopify and Cloudflare base safe to clone by removing known security,
scalability, compliance, and versioning defects without adding application
policy to the template.

## Scope

The implementation covers the defects identified in the template review:

- pin all Shopify-facing API declarations to the current stable `2026-07`
  version;
- make attachment uploads server-owned, tenant-bound, expiring records instead
  of client-controlled R2 metadata;
- adopt attachments only once, as part of the same durable D1 write as their
  message;
- remove full-KV-namespace session scans from request, webhook, and purge
  paths;
- delete abandoned uploads using a bounded scheduled sweep and include them in
  shop redaction;
- make compliance behavior unambiguous and validate the authenticated tenant
  before destructive redaction; and
- make local bindings non-billable by default and validate version/config
  coherence before deployment.

No product-specific Shopify scopes, webhooks, billing policy, or customer-data
schema is introduced. Apps that add customer data must implement their own
customer request/redaction handlers in the same change.

## Attachment Ownership

`pending_uploads` is a new shop-scoped D1 table. The upload endpoint writes a
row after R2 accepts the object. The row contains an opaque upload id, owner
shop, optional existing ticket id, R2 key, server-observed content type and
size, creation time, and expiry time. It is the only authority for attachment
metadata.

The browser submits only upload ids. A support use case claims the listed rows
by `(shop, upload id)` and requires the rows to be unexpired and unclaimed. In
one D1 batch it writes the message/attachment rows and marks the pending rows
adopted. Replays, a foreign upload id, stale uploads, and duplicate ids fail
without attaching an object. R2 keys, names, MIME types, and sizes are never
read from form fields.

Pending records expire after 24 hours. Scheduled maintenance deletes their R2
objects in batches and then removes their D1 rows. Shop redaction first lists
both adopted and pending keys for its authenticated shop, deletes every key,
then deletes all associated rows. This keeps deletion correct when a merchant
abandons a form.

## Sessions

The per-shop KV index is the only lookup mechanism. `findSessionsByShop` lists
only the `shopidx:{shop}:` prefix and loads index misses by id; it never lists
the global `session:` prefix. A lost index entry is handled as a bounded stale
session rather than turning an uninstall/redaction into an account-wide scan.
Store/delete operations continue to maintain both entries.

## Compliance

`shop/redact` uses the verified shop returned by Shopify authentication as the
tenant authority. A mismatching payload domain is logged and rejected rather
than selecting another tenant. The customer topics state that the base stores
no customer records; this remains a declared no-data response, not a claim
that a generic handler has implemented future applications' data policy.

## Versioning And Operations

All Shopify Admin/webhook TOML and runtime declarations use `2026-07`, the
current stable release. Partner API use remains `2026-07` and its existing
operations are validated against that schema. Development does not configure
remote Email Sending or Workers AI bindings, so local development and test
runs cannot create charges by default. Production keeps explicit bindings.

The deployment preflight asserts the runtime API version, both TOML webhook
versions, and the Partner API version match their required values where
applicable.

## Testing

Every behavior starts with a failing test. Required regressions include:

- a foreign or tampered upload cannot be adopted or downloaded through another
  shop;
- an upload id can only be adopted once and only before expiry;
- failure while adopting leaves neither a partial attachment nor a claimed
  pending row;
- scheduled cleanup deletes expired pending R2 keys and rows;
- shop redaction deletes both pending and adopted keys for exactly one shop;
- session lookup never performs a global `session:` listing; and
- API/config versions remain mutually consistent.

Run focused red/green tests for every task, then full Vitest, typecheck, lint,
build, Drizzle migration application, Shopify schema validation, and the
deployment preflight.
