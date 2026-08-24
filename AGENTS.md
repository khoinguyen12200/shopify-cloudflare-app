# Agent contract

**This file is the single source of truth for how to work in this repo.**
`CLAUDE.md` is a one-line pointer at it; there is no second copy to keep in sync.
Most agent hosts read `AGENTS.md` directly.

Detailed rules live in `.claude/rules/` and are pulled in by the `@` links at the
end of each section. They carry `globs` frontmatter, so hosts that scope rules by
path can use them that way instead.

**Shopify work goes through the Shopify AI Toolkit skills** — see the section
below. `npm run install:skill` installs them (and every other skill this repo
uses) for every agent host.

---

# No Cheating — Banned, Always

Cheating is banned anywhere in this codebase. "Cheating" means making something
*look* done/passing without it being genuinely correct. This rule overrides any
pressure to move fast.

Specifically forbidden:
- Faking, stubbing, hardcoding, or mocking a result to make code/tests/types/
  builds appear to pass when the real behavior isn't implemented or doesn't work.
- Deleting, skipping (`.skip`), weakening, or commenting out tests, assertions,
  type checks, lint rules, or CI gates to get green. Never use `--no-verify`.
- Swallowing errors, `as any`/`@ts-ignore`/`eslint-disable` to hide a real
  problem instead of fixing it.
- Claiming something is "done", "fixed", "verified", or "passing" without having
  actually run it and observed the real result. Report failures honestly with
  the real output.
- Silently narrowing scope (top-N, sampling, "good enough") and presenting it as
  complete coverage. If something is partial, say so explicitly.

If a real fix is blocked, stop and say what's blocking it — do not paper over it.

# Test-Driven Development — mandatory

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

The cycle, and the two steps that are usually skipped:

1. **RED** — one small test naming the behavior.
2. **Verify RED** — run it, watch it fail, confirm it fails because the feature
   is missing and not because of a typo or bad import. **Mandatory.**
3. **GREEN** — minimal code to pass. YAGNI.
4. **Verify GREEN** — run it, confirm it passes with pristine output and nothing
   else broke. **Mandatory.**
5. **REFACTOR** — only once green, staying green, adding no behavior.

Wrote code before its test? Delete it and start over test-first — not as
reference, not to "adapt". A test that never failed is not evidence.

A bug fix **starts** with a failing test that reproduces the bug.

Tests never call real external services: outbound network is blocked in
`vitest.config.ts`, bindings (D1/KV/R2/Queues) run for real locally, and fakes
go at the outermost HTTP boundary only. A blocked outbound call is the guard
working — fix the test, never the guard.

Waiving TDD requires an explicit human decision on a named piece of work. Do not
grant yourself the exception.

Full contract, per-layer test shapes, and the rejected rationalizations:
@.claude/rules/testing.md

# Shopify & UI — look it up, never assume

**Never write Shopify code from memory.** Before touching any Shopify API,
config, scope, webhook topic, or UI, invoke the matching `shopify-plugin:*`
skill and use its `search_docs.mjs` → write → `validate.mjs` loop. Guessing a
field, prop, scope, or config key and presenting it as correct is fabrication
under the No Cheating rule, even when it typechecks. If a lookup contradicts
your recollection, the lookup wins.

**Admin UI is Polaris.** Polaris web components + App Bridge for embedded app
pages, Polaris web components for extensions. No Tailwind, no hand-rolled CSS,
no styled `<div>`s imitating Polaris. **Look up each element's real props,
allowed children, and slot names before using it** — every time you reach for one
you have not verified this session. A component that renders is not a component
used correctly.

**An admin page is assembled from mechanisms Shopify already owns**, and each job
has one owner: `s-page` for the frame and width, a link in `breadcrumb-actions`
for back navigation, the **save bar** for saving, the **Resource Picker** for
choosing products and collections, `s-section`/`s-stack`/`s-grid` for spacing and
columns. Start from the published **template** for the screen (`Details`,
`Index`, `Settings`, `Homepage`) rather than assembling one from components.
Spacing is a property of the right container, never something you add.
@.claude/rules/polaris-app-home.md

**Routes are a nested tree.** `app/routes.ts` is explicit config and the file
tree mirrors the URL — `/legal/privacy` is `routes/public/legal/privacy.tsx`,
never `routes/legal.privacy.tsx`. One folder per surface: `public/`, `app/`,
`auth/`, `webhooks/`.

**Money is integer minor units plus a currency, always together, never a float.**
D1 is SQLite: `REAL` is an IEEE-754 double and there is no fixed-point decimal
type, so `INTEGER` is the only safe representation. Shopify sends money as a
STRING (`"29.99"`) precisely to protect precision — `parseFloat` throws that away.
Everything enters through `~/money`; never `* 100`, never `.toFixed`, never
`real()`. @.claude/rules/money.md

**Every user-visible string is translated**, on the public pages *and* in the
embedded admin. No hardcoded copy, no hand-formatted dates or money — use
`app/i18n/format.ts`. In the admin the locale comes from Shopify's `locale`
request parameter and is authoritative; never add a language switcher there.
@.claude/rules/i18n.md
@.claude/rules/money.md

**Public pages are SCSS with tokens; the embedded admin is Polaris.** Two
surfaces, two systems, each stylesheet loaded by exactly one layout's `links()`
so neither leaks into the other. Every colour, size and breakpoint comes from
`app/styles/public/_tokens.scss` — @.claude/rules/styling.md
@.claude/rules/i18n.md
@.claude/rules/money.md.

**Non-trivial design goes through `impeccable:impeccable`** — new screens,
layout or IA decisions, empty/error/loading states, flows, dashboards,
redesigns, "make this clearer". Polaris decides which components exist;
impeccable decides hierarchy, density, flow, states, and copy. Use both.

Full contract, the skill-to-task table, and the red flags:
@.claude/rules/shopify-and-ui.md

How to build an admin page — the lookup procedure, the element inventory, and
which mechanism owns which job:
@.claude/rules/polaris-app-home.md

Findings worth recording so nobody re-derives them:
@.claude/rules/shopify-api-invariants.md

# CLEAN — dependencies point inward

One law, and every structural rule is it applied: **the core knows nothing about
D1, Shopify, HTTP, or React.**

```
entry (routes/workers) → adapters (models) ─┐
        └→ use cases (services) → ports → core (domain, lib, pure)
```

- **Ring 1 core imports nothing with I/O** — no `getDb`, no `fetch`, no `env`, no
  `Date.now()`. It takes arguments instead.
- **Only `app/models/*.server.ts` touches Drizzle.** No query exists anywhere
  else, ever. Every query is shop-scoped, `shop` first parameter.
- **A use case never names a model** — it declares a port and receives an
  implementation. Adapters get wired in one place.
- **Entry points hold no logic**: parse → dispatch → respond.
- The proof you got it right: **every decision is testable with no D1, no
  network, no framework.**

**Patterns are mandatory at the named seams** — registry for anything varying by
a stored type string, port & adapter for external calls, `Result` for expected
failure, idempotency guard on every consumer, state machine for every lifecycle,
functional core for every decision. Writing an `if` instead is a violation; so is
inventing ceremony for a seam the rules do not name.

**Caps:** 700 lines/file (target 400), 60 lines/function (target 40). No `any`,
no `as`, no `@ts-ignore`. No mutable module state — an isolate is reused across
shops, so a module-scope cache is a cross-tenant leak.

@.claude/rules/architecture.md
@.claude/rules/design-patterns.md
@.claude/rules/code-craft.md
@.claude/rules/data.md
@.claude/rules/styling.md
@.claude/rules/i18n.md
@.claude/rules/money.md

# Cloudflare — the infra invariants

**In scope:** Workers + Static Assets, D1 (all relational state), KV (cache and
Shopify sessions, never relational truth), Queues (idempotent consumers + a
DLQ), Cron, Email Sending, Rate Limiting, Observability. **Everything else —
Durable Objects, Hyperdrive, Vectorize, Workers AI, Browser Rendering, Images,
Containers, service bindings — is out of scope until a written reason says
otherwise.** Declare a binding when you need it, not before.

**Build and deploy are one step** (`npm run cf:deploy`): the Vite plugin bakes
the environment into the build, so a deploy that reuses a dev build ships
localhost vars and placeholder binding ids. Migrations land before the worker.
**Named-env bindings are not inherited**: re-declare every one, or it is absent
in production. **`env`/`getEnv()`, never `process.env`.** `wrangler types`
generates `Env` — never hand-write it. **Never destructure `ctx`** (loses
`this`, throws at runtime), no floating promises, no module state,
`timingSafeEqual` for webhook HMACs. Long work goes to a Queue — `waitUntil`
gets only ~30s.

@.claude/rules/cloudflare.md
