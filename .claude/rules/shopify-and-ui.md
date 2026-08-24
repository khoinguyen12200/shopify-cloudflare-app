---
description: Never write Shopify code from memory — search the Shopify skill's docs first, validate after. Admin UI is Polaris, and every element's real API is looked up before it is used. Non-trivial design goes through impeccable. Apply to any Shopify API, config, scope, or UI work.
globs:
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "extensions/**/*"
  - "shopify.app*.toml"
  - "**/*.graphql"
alwaysApply: true
---

# Shopify APIs and admin UI

Two rules, one reason. Shopify's APIs and component libraries change faster than
any model's training data, and a plausible-looking wrong answer here costs a
failed app review or a broken merchant install. **Assumption is the failure
mode this rule exists to prevent.**

This is the No-Cheating rule applied to external APIs: inventing a component
prop, a mutation field, a scope name, or a config key — and presenting it as
correct — is fabrication, even when it typechecks.

## 1. Never write Shopify code from memory

Before writing or changing **any** Shopify-touching code, invoke the matching
skill from the Shopify AI Toolkit plugin (plugin name `shopify-plugin`, so the
skills are invoked as `shopify-plugin:<skill>`):

| What you're touching | Skill |
|---|---|
| Embedded admin UI (App Home, Polaris) | `shopify-polaris-app-home` |
| Admin UI extensions (`s-admin-block`, `s-button`, …) | `shopify-polaris-admin-extensions` |
| Admin GraphQL queries/mutations | `shopify-admin` |
| Running/validating via CLI, `shopify.app.toml`, store auth | `shopify-use-shopify-cli` |
| Metafields / metaobjects | `shopify-custom-data` |
| Functions (discounts, cart/checkout validation) | `shopify-functions` |
| Analytics/aggregate numbers | `shopify-shopifyql` |
| App Store submission readiness | `shopify-app-store-review` |
| Anything else Shopify, or you're unsure which | `shopify-dev` |

**Scopes, webhook topics, protected-data requirements, billing, rate limits,
API version behavior — all of it goes through a skill lookup, not recall.**
"I'm fairly sure the scope is `write_discounts`" is not a source. Look it up.

### The loop the skills require

The Polaris/API skills mandate a concrete sequence, and it is not optional:

1. `scripts/search_docs.mjs "<query>"` — **search before writing code.**
2. Write the code against what the search returned.
3. `scripts/validate.mjs --code '...'` — **validate before returning it.**
4. Validation failed? Search the error, fix, re-validate (the skills cap this
   at 3 retries). Never return unvalidated code.

Set `OPT_OUT_INSTRUMENTATION=true` in your environment if you do not want the
scripts reporting usage telemetry to shopify.dev. It changes nothing else —
`search_docs.mjs` and `validate.mjs` still work normally. Never remove it to
"fix" a script, and never skip validation because telemetry is off.

If a lookup contradicts something in this repo's docs or in your memory, the
lookup wins — and say so out loud rather than silently picking one.

### Record what you verify

Findings that were expensive to establish (an API-version quirk, a mutation that
behaves unlike its docs, a scope that turns out to be protected data) go into
`@rules/shopify-api-invariants.md`, so the next person does not re-derive or
contradict them. Findings that are still unverified must be **labelled
unverified** — recording a guess is useful, presenting it as settled is not.

## 2. Admin UI is Polaris — and you look up every element

All merchant-facing admin UI in this app is **Polaris**. Not Tailwind, not
hand-rolled CSS, not a component library you like better, not raw `<div>`s
styled to look like Polaris.

This applies to the **embedded admin** (`/app/**`) and to extensions. The
**public** pages — landing, pricing, legal, support — are a different surface:
they are not embedded, have no App Bridge, and are styled with SCSS tokens per
`@rules/styling.md`. Do not bring Polaris there, and do not bring SCSS here.

- Embedded app pages (`app/routes/**`): Polaris **web components** (`s-page`,
  `s-section`, `s-button`, …) + App Bridge, via `AppProvider` from
  `@shopify/shopify-app-react-router/react`. `@shopify/polaris-types` supplies
  their JSX types.
- Admin UI extensions (`extensions/**`): Polaris **web components**
  (`s-admin-block`, `s-button`, …).

Which elements exist depends on the installed `@shopify/polaris-types` version —
they are added and removed between releases. Never assume an element exists
because it did in an older template; if the JSX type is missing, the element is
not available to you and the skill will say what replaced it.

**Before using any Polaris element, know its actual API.** Look up the
component's real props, allowed children, and layout semantics via the skill
first — every time you reach for one you have not verified in this session.
Guessing a prop name, nesting components in a combination Polaris does not
support, or reaching for CSS because a prop "should" exist are all rule
violations. A component that renders is not a component used correctly.

Polaris also carries the accessibility and interaction behavior for free. Reimplementing
a Polaris pattern by hand throws that away and fails app review.

Corollary from `@rules/testing.md`: Polaris web components cannot be
meaningfully unit-tested. TDD the server side, verify the UI by hand, and **say
honestly** that it was verified by hand — never fake coverage by mocking the
component tree.

## 3. Non-trivial design or UI work goes through impeccable

For anything beyond a mechanical, single-element change, invoke
**`impeccable:impeccable`** before building. That means: a new screen or route,
a layout or information-architecture decision, an empty/error/loading state, an
onboarding or wizard flow, a dashboard, a redesign, or any "make this look
better / clearer / less cluttered" request.

Polaris and impeccable are not alternatives. **Polaris decides what the
components are; impeccable decides the hierarchy, density, flow, states, and
copy.** Use both: run the design thinking through impeccable, express the result
in verified Polaris elements.

Skip impeccable only for a genuinely trivial change — one label, one prop, a
copy fix — and only when you are not making a layout decision.

## Red flags — stop and look it up

- "I think the field is called…" / "it should accept…"
- Writing a GraphQL mutation without having searched its current shape
- Adding a scope because it sounds right
- Reaching for custom CSS in an admin surface
- Building a new screen without invoking impeccable
- Returning Polaris code that `validate.mjs` never saw
