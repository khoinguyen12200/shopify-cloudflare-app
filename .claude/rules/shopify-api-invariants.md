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
| _(nothing recorded yet)_ | | |

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

- _(nothing recorded yet)_

## When you verify something

Move it up with **what you observed and when**. When a lookup contradicts this
file, the lookup wins — fix this file in the same change, and say out loud that
it was wrong. Deleting a stale row is as valuable as adding a true one.
