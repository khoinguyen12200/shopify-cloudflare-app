---
description: The project's log of hard-won Shopify API findings — what is settled, what is still unverified, and the design consequence of each. Read before relying on remembered API behavior; add to it whenever a lookup or a real store teaches you something costly.
globs:
  - "app/services/**"
  - "app/adapters/**"
  - "app/models/**"
  - "app/routes/webhooks*"
  - "extensions/**"
alwaysApply: true
---

# Shopify API invariants

**This file starts empty on purpose.** It is the project's memory, not a
reference — you fill it in as you learn.

A memo, not an authority. **The skill lookup always wins** — see
`@rules/shopify-and-ui.md`. What this file buys is two things:

1. Nobody re-derives a finding that already cost someone an afternoon.
2. Items that are still *unverified* stay labelled unverified, instead of
   hardening into folklore by repetition.

## Settled — do not re-litigate

Record a finding here only once it is confirmed against real docs or a real
store. Every row needs the design consequence, not just the fact — a fact
without its consequence gets re-argued.

| Finding | Verified how / when | Design consequence |
|---|---|---|
| **Events (`[events]` in `shopify.app.toml`) is a developer preview and exists only on the `unstable` API version.** The docs are explicit: *"Events is available only on the unstable API version… For all production use cases continue to use webhooks."* Inside `[events]`, `api_version` is a required field; needs CLI ≥ 3.92 | shopify.dev docs lookup, 2026-08-24 — [Manage Events subscriptions](https://shopify.dev/docs/apps/build/events/subscribe), [Events reference](https://shopify.dev/docs/api/events/unstable) | **Do not add `[events]` to this repo's tomls.** Subscriptions stay in `[webhooks]`. `api_version` in `[events]` is a separate track from the webhooks `api_version` and would pin to `unstable` — never keep them in step |
| Subscriptions are array-of-tables entries: `[[events.subscription]]` with `handle` / `topic` / `actions` / `uri`. There is no documented `subscription = []` scalar form | Same lookup, 2026-08-24 | If Events is ever adopted, copy the documented shape; an empty-array placeholder is not it |
| **Partner API 2026-07 `SubscriptionStatus.cancelEffectiveOn` is a nullable `Date`, not a `DateTime`.** `occurredAt` is a separate `DateTime`; the state enum includes `CANCELED`, `CANCELLATION_SCHEDULED`, `CREATED`, `FROZEN`, `UNFROZEN`, and `UPDATED` | Partner toolkit docs lookup, 2026-09-09 — [SubscriptionStatus](https://shopify.dev/docs/api/partner/2026-07/objects/SubscriptionStatus), [SubscriptionStatusState](https://shopify.dev/docs/api/partner/2026-07/enums/SubscriptionStatusState) | Preserve the cancellation date as date-only metadata. Never invent midnight-UTC precision; exact authorization boundaries require authoritative current subscription data or a documented fail-closed path |
| **Partner API 2026-07 `activeSubscription(appId, shopId)` can return null when no active managed-pricing contract exists.** The documented response exposes billing period, deferred cancellation, trial end, current billing cycle, items, and pending update; access requires Partner Manage apps permission for public apps | Partner toolkit docs lookup, 2026-09-09 — [Active subscription](https://shopify.dev/docs/api/partner/2026-07/active-subscription) | Treat missing response as distinct from an observed free/inactive projection. Do not authorize from object existence alone; parse and persist the relevant fields from an authoritative refresh |
| **Partner API 2026-07 billing cycles are explicit `DateTime` bounds.** `BillingCycle.startTime` is when the current cycle started and `endTime` is when the next charge occurs; app pricing intervals include annual and every-30-days | Partner toolkit docs lookup, 2026-09-09 — [BillingCycle](https://shopify.dev/docs/api/partner/2026-07/objects/BillingCycle), [AppPricingInterval](https://shopify.dev/docs/api/partner/2026-07/enums/AppPricingInterval) | A renewal boundary is not automatically a monthly entitlement period. Preserve authoritative cycle bounds and billing interval separately |
| **Partner API 2026-07 cancellation/trial fields are nullable by documented state.** `CancelledSubscription.cancelledAt` is null for deferred cancellation, `currentBillingCycle` is null during trial, `trialEndsAt` is null without an active trial, and `pendingUpdate` is null when absent | Partner toolkit docs lookup, 2026-09-09 — [CancelledSubscription](https://shopify.dev/docs/api/partner/2026-07/objects/CancelledSubscription) | Keep nulls distinct from confirmed inactive/free state; do not infer cancellation, trial completion, or replacement from field absence |
| **Partner API 2026-07 frozen/unfrozen events describe recurring-charge suspension and resumption.** They do not specify this app's authorization retry policy | Partner toolkit docs lookup, 2026-09-09 — [SubscriptionChargeFrozen](https://shopify.dev/docs/api/partner/2026-07/objects/SubscriptionChargeFrozen), [SubscriptionChargeUnfrozen](https://shopify.dev/docs/api/partner/2026-07/objects/SubscriptionChargeUnfrozen) | New work must follow the app's authoritative refresh and fail-closed policy; do not treat event/object existence as sufficient proof of current access |
| **Partner API 2026-07 relationship events distinguish installed, reactivated, and uninstalled app relationships.** `RelationshipUninstalled` includes shop, occurrence time, reason, and description; `RelationshipInstalled` and `RelationshipReactivated` identify their corresponding events | Partner toolkit docs lookup, 2026-09-09 — [Relationship](https://shopify.dev/docs/api/partner/2026-07/objects/Relationship), [RelationshipInstalled](https://shopify.dev/docs/api/partner/2026-07/objects/RelationshipInstalled), [RelationshipReactivated](https://shopify.dev/docs/api/partner/2026-07/objects/RelationshipReactivated), [RelationshipUninstalled](https://shopify.dev/docs/api/partner/2026-07/objects/RelationshipUninstalled) | Keep installation eligibility as a separate local fence. The Partner event descriptions do not define reinstall authorization for historical jobs or this app's refresh retry semantics |

Two that hold for every Shopify app, so they are here from the start:

| Finding | Design consequence |
|---|---|
| Webhooks deliver **at-least-once** | Every handler is idempotent — `@rules/design-patterns.md`. The replay test ships with the handler, not later |
| A mutation's shape is only true **for an API version** | Pin the version you checked against. `apiVersion` in `app/shopify.server.ts` and `api_version` in both `shopify.app*.toml` are the same decision — change them together |

## Webhook delivery, compliance and offline tokens (2026-10-08)

Verified against shopify.dev docs lookup on 2026-10-08. The first table is what the docs state; the second is what we
observed or inferred and is labelled as such.

| Finding (documented) | Source | Design consequence |
|---|---|---|
| A delivery succeeds only on a 2xx. **Any other status, including 3xx and 4xx, is a failure.** Shopify allows a 1 s connect timeout and 5 s for the whole request, retries up to **8 times over 4 hours**, and after 8 consecutive failures **deletes the subscription if it was created through the Admin API** (app-specific `shopify.app.toml` subscriptions are not removed, but that delivery is lost). | [Verify deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), [Troubleshoot](https://shopify.dev/docs/apps/build/webhooks/troubleshoot) | Entries acknowledge fast and hand off to a queue. A lost `app/uninstalled` or `shop/redact` is a compliance problem even when the subscription survives |
| HMAC is `base64(HMAC-SHA256(raw body, client secret))` in `X-Shopify-Hmac-SHA256`, compared in **constant time**, over the **raw** body. A length mismatch must not throw: in Node, `timingSafeEqual` on different-length buffers throws and surfaces as a 500. | [Verify deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), [Monitor orders](https://shopify.dev/docs/agents/get-started/monitor-orders) | `verifyShopifyWebhook` uses `crypto.subtle.verify` (constant time, returns `false` on any length) and answers 401, never 500 |
| If you rotate the app's client secret, **it can take up to an hour for the webhook HMAC to be generated with the new secret.** (The explicit "accept both secrets until one hour after revocation" rule exists only in the Shipping Partner Platform docs, [Authentication](https://shopify.dev/docs/beta/shipping-partner-platform/authentication); it is **not** stated for app webhooks.) | [Verify deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries) | `verifyShopifyWebhook` takes one secret. Because of the up-to-an-hour window, a rotation would reject genuine deliveries unless the verifier accepts the old and new secret together. That accommodation is our inference from the documented delay, not a documented requirement. **Open gap** |
| Compliance webhooks (`customers/data_request`, `customers/redact`, `shop/redact`): answer **2xx** to confirm receipt, complete the action within **30 days**, and an **invalid HMAC must return 401**. `shop/redact` is sent **48 hours after uninstall**; `customers/redact` can be withheld up to six months. | [Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance) | Never turn a 401 into a 200. `shop/redact` always arrives after the shop's tokens are dead, so a handler that needs a live session can never succeed |
| Expiring offline tokens last **60 minutes** with a 90-day refresh token. When no merchant session is active (webhooks, background jobs) the app refreshes server-side with the stored refresh token. **Refresh one store at a time**: two workers refreshing the same store concurrently can leave one holding a token the other already replaced. Persist each returned pair atomically. | [Offline tokens changelog](https://shopify.dev/changelog/posts/offline-access-tokens-now-support-expiry-and-refresh), [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens), [More resilient refreshes](https://shopify.dev/changelog/posts/more-resilient-refreshes-for-expiring-offline-access-tokens) | Serialising refresh per shop is an **open gap** here: no lock exists in the Worker, and the library does not take one |
| A refresh that returns **401 `invalid_request`** is Shopify's single answer for every terminal case, **including a revoked or uninstalled app**. Treat it as **final**: stop retrying and re-authenticate on the next merchant visit. Network errors, timeouts, 5xx and 429 are transient and safe to retry. | [Authenticate without a template](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange?lang=node) | A refresh failure for an uninstalled shop is an expected terminal state, not a server fault, and must never become a 500 |
| An expired or invalid ID token makes Shopify answer 400. The app should reply **401 with `X-Shopify-Retry-Invalid-Session-Request: 1`**; 5xx is reserved for failures a fresh token cannot fix. | [Authenticate without a template](https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange?lang=node) | Client-caused auth failures are 4xx. A malformed `host` is the same kind of caller error and answers 400 |
| Dedupe on `X-Shopify-Webhook-Id`; ordering is not guaranteed; delivery is not guaranteed, so run **reconciliation jobs** that re-fetch from the API. | [Verify deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries), [About webhooks](https://shopify.dev/docs/apps/build/webhooks) | Idempotency guard on every consumer (already required). A missed `app/uninstalled` is recovered by reconciliation, not by hoping for the retry |

| Observation or inference | How established | Design consequence |
|---|---|---|
| **`shopify.authenticate.webhook` (shopify-app-react-router) loads the offline session and, when it is within 5 minutes of expiry, refreshes it; any refresh failure becomes `throw new Response(undefined, { status: 500 })`.** The docs show this call as the way to verify a webhook and do not mention the refresh. | Read `authenticate/webhooks/authenticate.mjs`, `ensure-offline-token-is-not-expired.mjs` and `refresh-token.mjs` in the installed package; reproduced as a 500 in a test; production trace `kv_get → fetch → HTTP 500` for `app/uninstalled`, 2026-10-08 | Do not use `authenticate.webhook` where no Admin API session is needed. Use `verifyShopifyWebhook` (`app/adapters/shopify-webhook.server.ts`). It contradicts the docs' guidance to treat a terminal refresh 401 as final, so it is a library defect we route around, not a documented behaviour |
| The `host` query parameter is passed to `new URL("https://" + atob(host))` unguarded by `sanitizeHost`, so base64-valid garbage such as `9998966025409999999` throws and becomes a 500. | Read `shop-validator.mjs`; production 500 on 2026-10-08; unit test | `isSafeHostParameter` runs before the library and answers 400. This guard is ours; Shopify's docs do not specify host validation |
| **Decision (inference):** a validly signed delivery whose payload our parser rejects keeps a **non-2xx** answer. Retrying an identical payload cannot succeed, but Shopify retries 8 times over 4 hours, and during that window a too-strict schema can be fixed and redeployed so the retry lands. Acknowledging with 2xx would turn that into silent data loss, which is worst for compliance. The answer is made safe by keeping schemas lenient (require only the fields used) and by logging the rejection loudly. | Follows from "any non-2xx is a failure" and the 4-hour retry window | Compliance and scopes-update routes keep their 400. `verifyShopifyWebhook` answers 400 only for an envelope that cannot be attributed to a shop (bad domain, missing topic/id header, non-JSON body) |
| **Decision (inference):** the `shop/redact` purge stays **inside the request**. A queued purge would acknowledge before the erasure ran, and the purge deletes the delivery row the queue consumer is processing. The 5 s limit is the risk, so `compliance.handled` logs `durationMs` for every compliance delivery. | Docs: 5 s timeout, "process asynchronously", 30 days to complete | If `durationMs` for `SHOP_REDACT` ever approaches 3000 ms, move the purge behind the queue (and handle a Shopify retry arriving after the shop row is gone) |
| **Open gap:** refreshes are not serialised per shop. The library refreshes inside `authenticate.admin` / `unauthenticated.admin` and exposes no hook for a lock. Shopify's 2026-08-28 change (the previously used refresh token stays usable until its replacement is used) is the documented safety net. | [Access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens), [More resilient refreshes](https://shopify.dev/changelog/posts/more-resilient-refreshes-for-expiring-offline-access-tokens) | A real lock needs a per-shop coordinator (Durable Object, which is out of scope in `@rules/cloudflare.md` without a written reason, or a D1 lease around every call site) |
| **Open gap:** a missed `app/uninstalled` (Shopify gave up after 4 hours) leaves the shop marked installed. The library reports every refresh failure as a bare 500, so it cannot tell a terminal 401 from a transient error; telling them apart needs our own call to the token endpoint. | Read `refresh-token.mjs`; docs: terminal 401 `invalid_request` vs transient 5xx/429 | A reconciliation sweep should refresh via our own token-endpoint call, treat a 401 `invalid_request` as uninstalled, and retry the rest |

## Unverified — must be confirmed before anything depends on it

Anything in this section stays labelled unverified until someone observes it
against a real store or reads it in current docs. **Repetition is not
verification.** Recording a guess here is fine and useful; presenting it as
settled is not.

- **`shopify app dev` failing with `Validation error … [events]: Required`.** Reported from another project on CLI 4.7.0, and plausible, but **not reproducible here** (this repo's `shopify.app.dev.toml` has `client_id = ""`, so `shopify app config validate` demands linking and interactive auth first). It is almost certainly **not** a CLI-version fact: `[events]` is an opt-in developer preview per the settled rows above, and the same report notes both that error and the contradictory `Unsupported section(s) in app configuration: events` derive from *the linked app's remote specification set*. So it is a property of a particular app's spec set, not of the scaffold.
  If you hit it: add the section to the toml that failed, using the documented shape and `api_version = "unstable"` (the only value Events accepts), confirm with `shopify app config validate --json`, and record here which app and CLI version it applied to. Do **not** add it pre-emptively — that opts every app built on this scaffold into a preview API the docs say to keep out of production.

## When you verify something

Move it up with **what you observed and when**. When a lookup contradicts this
file, the lookup wins — fix this file in the same change, and say out loud that
it was wrong. Deleting a stale row is as valuable as adding a true one.
