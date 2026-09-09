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
