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
