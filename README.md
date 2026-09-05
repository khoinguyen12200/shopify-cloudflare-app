# shopify-cloudflare-app

Scaffold for Shopify apps on Cloudflare Workers. Start a repo from it, run two
commands, and start building — nothing app-specific is in here.

This is a **GitHub template repository**, not something you fork. (GitHub will
not let you fork a repo you already own into your own account, and a template is
the better fit anyway: the new repo starts with clean history and no upstream
link.)

## Stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Runtime    | Cloudflare Workers (workerd), via `@cloudflare/vite-plugin` |
| Framework  | React Router 7 (SSR) + Vite 8, explicit nested route config |
| Shopify    | `@shopify/shopify-app-react-router` v2, Admin API 2026-10  |
| Admin UI   | Polaris **web components** + App Bridge (embedded only)    |
| Public UI  | SCSS design tokens (`app/styles/public/`), dark mode + a11y |
| Staff console | `/internal` — ngk-dashboard + Tailwind v4, PBKDF2 auth      |
| i18n       | i18next + `remix-i18next`, `en` + `es`, `Intl` formatting  |
| Money      | integer minor units + currency (`app/money/`), never a float |
| State      | D1 + Drizzle (`app/db/`, queried only in `app/models/`)   |
| Sessions   | Workers KV (`app/session-storage.server.ts`)              |
| Tests      | Vitest + `@cloudflare/vitest-pool-workers` (real workerd) |

Dev runs in workerd with real D1/KV bindings under Miniflare, so local
behaviour matches production.

## Starting a new project from it

```bash
gh repo create my-new-app --template khoinguyen12200/shopify-cloudflare-app --private --clone
cd my-new-app
```

Or hit **Use this template → Create a new repository** on GitHub. Then:

```bash
npm install                         # also installs Claude/Codex skills
cp .dev.vars.example .dev.vars      # then READ it — an empty KEY= line is worse
                                    # than an absent one; it shadows what
                                    # `shopify app dev` injects

# Create your own Shopify apps — one for dev, one for prod (see below).
# `config link` OVERWRITES the local toml with the remote app's configuration —
# it is not a read-only "fill in the client_id" step. It will discard comments,
# the [build] block, webhook subscriptions, scopes and redirect URLs. Diff it:
npm run config:link:dev && git diff shopify.app.dev.toml
npm run config:link:prod && git diff shopify.app.toml

# Create the Cloudflare resources and paste the ids into wrangler.jsonc
npx wrangler d1 create app-db-prod
npx wrangler kv namespace create SESSION
npm run cf-typegen                  # regenerate Env after editing wrangler.jsonc

npm run dev
```

Nothing above touches production. Local dev runs entirely on Miniflare, which
simulates each binding by name and ignores the placeholder ids in the top-level
`wrangler.jsonc`.

When you are ready to deploy, set the production `client_id` into `wrangler.jsonc`
(`env.production.vars.SHOPIFY_API_KEY`) and `SHOPIFY_APP_URL`, and set
`SHOPIFY_API_SECRET` with `npx wrangler secret put SHOPIFY_API_SECRET --env production`.
The client ID is public configuration; the API secret is not.

Secret **names** are declared in `wrangler.jsonc` under `secrets.required`, so
`npm run cf-typegen` types `Env` correctly with no `.dev.vars` present — a fresh
clone and a CI runner both compile. Add a name there when you add a secret;
values never go in that file.

### Before you subscribe to an order or customer topic

`orders/*` and `customers/*` payloads carry protected customer data (name,
email, address), and Shopify gates them: without an approved request,
`shopify app dev` will not start. Approval is a Dev Dashboard step — Apps → your
app → API access requests — and it needs a distribution method selected first.
It blocks local development, not just launch, so do it before you write the
handler.

## AI-agent skills

```bash
npm run install:skill                          # install/refresh everything
npm run install:skill -- --locked              # restore the committed skill set
npm run install:skill -- --agent claude-code   # one host only
```

`npm install` automatically restores the committed skill set for Claude Code
and Codex and verifies that every skill is available to both hosts without
rewriting `skills-lock.json`. Run
`npm run install:skill` manually when you intentionally want to refresh the
lockfile from the upstream skill repositories.

`skills-lock.json` is committed and lists every skill package this repo uses —
**48 skills from four sources**:

| Source | What it gives an agent |
| ------ | ---------------------- |
| `Shopify/shopify-ai-toolkit` (21) | Look up Admin GraphQL, Polaris, Functions, CLI, App Store review — the lookups `@rules/shopify-and-ui.md` requires |
| `obra/superpowers` (14) | `test-driven-development`, `verification-before-completion`, `systematic-debugging`, code review, planning |
| `remotion-dev/skills` (12) | React video, if a project needs it |
| `pbakaus/impeccable` (1) | Required design workflow and UI quality hooks |

`test-driven-development` and `verification-before-completion` are named directly
by `.claude/rules/testing.md`, so they are not optional extras — the rules assume
they are present, and `install:skill` is what makes that true.

The installed skills are **not** committed — they are ~90 MB and fully
reproducible from that lockfile, which is exactly why this command exists.
Expect the first run to take several minutes.

Where they land:

- **`.agents/skills/`** — the universal store. Most hosts read it directly:
  Codex, opencode, Amp, Cline, Cursor, Gemini CLI, Windsurf, Zed and others.
- **`.claude/skills/`** — symlinks into that store, for Claude Code.
- **`agent/`** — symlinks into that store, for Eve.

All three are gitignored. To add a skill, `npx skills add <owner>/<repo>` once —
it records the source in `skills-lock.json`, and every fork picks it up from
`npm run install:skill` after that.

## Two Shopify apps: dev and prod

`shopify app dev` rewrites `application_url` and `redirect_urls` to the current
tunnel URL every run. Pointed at your production app, that repoints live
merchants at a tunnel on your laptop. So there are two configs, each linked to
its own app in the Dev Dashboard — every project started from this template
creates its own pair, since `client_id` ships empty:

| File                   | App        | `automatically_update_urls_on_dev` | Used by                       |
| ---------------------- | ---------- | ---------------------------------- | ----------------------------- |
| `shopify.app.dev.toml` | "My App (Dev)" | `true` — tracks the tunnel      | `npm run dev`, `deploy:dev`   |
| `shopify.app.toml`     | "My App"   | `false` — URL is fixed             | `npm run deploy:prod`         |

Keep `[access_scopes]` and the webhook list in sync between them: a scope that
exists in only one env produces bugs that reproduce in only one env.

## The Shopify CLI is project-local

`scripts/shopify.mjs` wraps every CLI call, and all the `npm run` Shopify
scripts go through it. It gives you two kinds of isolation:

- **The binary** — runs this repo's `@shopify/cli` devDependency, not whatever
  `shopify` is on your `PATH`. The version is pinned in `package.json`.
- **The login session** — repoints the CLI's `HOME` (and the XDG/Windows
  equivalents) at a project-local `.shopify-home/`. So you can stay logged into
  your company account globally and into a different account for this project
  at the same time, with no logging in and out. `.shopify-home/` is gitignored.

Your real `wrangler` credentials are symlinked into that isolated home, because
wrangler runs inside `shopify app dev`.

## Deploying

```bash
npm run cf:deploy
```

That is `verify` → production build → D1 migrations → `wrangler deploy`, in one
step on purpose. **Never build and deploy separately**, and never run a bare
`wrangler deploy`:

> `@cloudflare/vite-plugin` bakes the resolved environment into
> `build/server/wrangler.json` at **build** time. `wrangler deploy --env
> production` on a dev build ignores the flag and silently ships
> `SHOPIFY_APP_URL: http://localhost:3000` plus the placeholder KV and D1 ids.

`CLOUDFLARE_ENV=production` at build time is what selects `env.production`.

Wrangler environments do **not** inherit bindings, vars, triggers or routes from
the top level, so `env.production` in `wrangler.jsonc` re-declares every one. Add
a binding in one place and it is simply absent in the other.

**`cf:deploy` refuses to run while a production binding still says `REPLACE_ME`.**
Without that gate, `wrangler deploy` succeeds and ships a Worker whose D1 and KV
point at nothing — which fails on a real request, with an error that says nothing
about the cause. The check runs first, so it costs seconds rather than a full
build.

The same guard checks production `client_id`, app URL and callback drift against
`shopify.app.toml`, matching dev/production scopes, Managed Pricing handles,
legal identity/contact/effective date, and public privacy/support/pricing copy.
Template TODOs are intentional: replace them before launch. Required secrets are
`SHOPIFY_API_SECRET`, `SHOP_CUSTOM_DOMAIN`, `INTERNAL_SESSION_SECRET`,
`SHOPIFY_PARTNER_API_TOKEN`, and `ATTACHMENT_TOKEN_SECRET`; set them with
`wrangler secret put` in production. `SHOPIFY_API_KEY` is a public client ID,
not a secret.
Create D1/KV/R2 resources first, copy IDs into `wrangler.jsonc`, then run
migrations before deploy. Keep Shopify Partner app ID and plan handles aligned
with TOML and billing plan registry. Set `SHOPIFY_PARTNER_ORGANIZATION_ID` to
the numeric ID from Partner Dashboard URL; keep `SHOPIFY_PARTNER_API_VERSION`
pinned to supported Partner version used by validated queries.

**Migrations retry on a transient Cloudflare 5xx.** `wrangler d1 migrations apply`
intermittently fails while querying migration state; in a deploy chain that
aborts the whole release for no reason. Applying migrations is idempotent, so
`scripts/migrate.mjs` retries with backoff — that property is what makes the
retry correct rather than hopeful.

## Layout

```
workers/app.ts                     Worker entry: fetch, and where scheduled/queue go
app/routes.ts                      Explicit route config — the only route index
app/request-context.server.ts      AsyncLocalStorage: getEnv() / getDb()
app/shopify.server.ts              createShopify(env) — per-request, no module state
app/session-storage.server.ts      KV-backed Shopify SessionStorage
app/db/schema.ts                   Drizzle schema → ./drizzle migrations
app/models/                        The ONLY layer that touches Drizzle; shop-scoped
app/services/                      Use cases (compliance webhook handlers live here)
app/styles/public/                 SCSS tokens + base for every public page
```

### Routes mirror the URL

`app/routes.ts` is explicit config, not flat file-name routing. One folder per
surface, nested to match the path:

```
app/routes/
├── public/              unauthenticated — no Polaris, SCSS tokens
│   ├── _layout.tsx        header, footer, skip link, loads public.scss
│   ├── landing.tsx        /
│   ├── pricing.tsx        /pricing
│   ├── support.tsx        /support
│   └── legal/
│       ├── privacy.tsx    /legal/privacy   ← REQUIRED by the App Store listing
│       └── terms.tsx      /legal/terms
├── app/                 embedded Shopify admin — Polaris + App Bridge
│   ├── _layout.tsx        /app        authenticates, provides AppProvider
│   └── home.tsx           /app        index
├── auth/
│   ├── login.tsx          /auth/login
│   └── callback.tsx       /auth/*     the library handles the rest
└── webhooks/
    ├── app/
    │   ├── uninstalled.tsx      /webhooks/app/uninstalled
    │   └── scopes-update.tsx    /webhooks/app/scopes_update
    └── compliance.tsx           /webhooks/compliance
```

`_layout.tsx` is the shell for its folder and the only place that surface's
stylesheet or shared auth check belongs.

## Internal staff console — `/internal`

Every app needs one, so it is scaffolded. Not merchant-facing: this is your
team's console for operating the app.

```
/internal/login       sign in (outside the layout, so it cannot redirect to itself)
/internal/dashboard   counts + a starting point for your own panels
/internal/admins      list, add, enable/disable, promote/demote, remove  (owner only)
/internal/admins/:id/reset   an owner resets someone else's password  (owner only)
/internal/profile     change your own name and password
/internal/logout
```

`admin_users` is **the one table that is not shop-scoped** — internal staff are
your team, not a merchant's records. Everything else stays shop-scoped.

### Signing in locally

`npm run dev` applies migrations and seeds a local admin automatically:

| | |
| --- | --- |
| Login path | `/internal/login` (append to the dev URL shown by Shopify CLI) |
| Email | `admin@localhost` |
| Password | `admin123` |

**That seed is a development fixture and cannot reach a real database.** It only
ever runs `wrangler d1 execute --local`, refuses any argument that looks like a
remote or production target, and refuses when `CI` or `NODE_ENV=production` is
set. `admin123` is deliberately below the 12-character minimum the console
enforces on passwords a human types.

For a real account:

```bash
npm run admin:create -- --email you@example.com --name "Your Name"
npm run admin:create -- --email you@example.com --name "You" --remote   # production
```

It prompts for the password (never pass it as an argument — arguments land in
shell history and `ps` output) and enforces the same policy as the UI.

### Auth

Passwords use **PBKDF2-HMAC-SHA256 at 600,000 iterations** over WebCrypto, which
workerd implements natively. `bcryptjs` — the usual choice — is pure JavaScript,
so every round burns the isolate's CPU budget as interpreted code. Measured here:
two full derivations at production parameters complete in well under a second.

The iteration count is stored **inside** the hash
(`pbkdf2$sha256$600000$<salt>$<hash>`), so it can be raised later without
invalidating existing passwords; `needsRehash()` upgrades a row on its next
successful login, the only moment the plaintext exists.

Guards that keep the console from locking you out, all tested:

- The **last active owner** cannot be disabled, demoted, or deleted — and a
  *disabled* owner does not count as a remaining one.
- You cannot disable, demote, or delete **yourself**.
- Disabling revokes access immediately, not at cookie expiry.
- An unknown email still runs a full hash derivation, so "no such user" is not
  measurably faster than "wrong password" (user-enumeration oracle).
- `INTERNAL_SESSION_SECRET` is **required** — the console refuses to serve rather
  than signing cookies with a constant.

Removing an admin goes through ngk-dashboard's `ConfirmDialog`, whose confirm
button submits a real hidden `<Form>` by id. So the destructive path is still a
plain POST to the route action with the same server guards — no fetch, no
client-side mutation path, and the copy is translated (a native `confirm()`
cannot be styled or localised, and does not exist during SSR).

**Password recovery.** An owner resets another admin's password at
`/internal/admins/:id/reset` — its own page, not a dialog, because the field has
to exist without JavaScript (a dialog's contents live in a portal that only
renders once opened) and a validated form needs somewhere to show its errors. It
does not require knowing the old password, which is the point. It refuses to
target your own account: that would turn a borrowed session into a takeover with
no knowledge of the old password, so your own password goes through
`/internal/profile`, which does require the current one.

**Self-service recovery.** `/internal/forgot-password` → emailed link →
`/internal/reset-password/:token`.

| Property | How |
| --- | --- |
| No user enumeration | The response is identical whether the account exists, is disabled, or the throttle tripped. What happened is in the log, never in the response |
| Token never stored | Only its SHA-256 goes in `password_reset_tokens`. A database leak yields nothing usable |
| Single use | Spending it sets `used_at`; a replay is reported as *used*, distinct from *invalid*, so clicking an old link twice gives an accurate message |
| Siblings die too | A successful reset invalidates every other outstanding link for that account, so an older email stops being a live key |
| Short lived | One hour |
| Throttled | At most 3 live links per account, so repeated requests cannot flood an inbox |
| A typo is free | The password policy and confirmation are checked **before** the token is spent, so one mistake does not burn the link |
| Not auto-signed-in | Clicking proves control of the inbox, not of the new password. You then sign in with it |
| Never indexed | The token is in the URL, so the page sets `robots: noindex, nofollow` |

Expired rows are pruned by a daily cron (`workers/app.ts` → `runScheduledSweeps`),
kept for 7 days first so a replay still reports accurately.

### Email setup, per project

The `send_email` binding is declared, but nothing sends until you do this:

```bash
npx wrangler email sending enable yourdomain.com
```

then set `EMAIL_FROM` (an address on that domain) and `EMAIL_FROM_NAME` in
`wrangler.jsonc` `vars`, **per environment** — named envs inherit nothing.

Until then `sendEmail()` returns `{ sent: false, reason: "notConfigured" }` rather
than throwing, and the forgot-password page shows the reset link on screen
instead of emailing it. **That on-screen fallback requires both an unconfigured
mailer and a non-production deployment** — on a real deployment it would let
anyone who can POST the form obtain a reset link for any account.

## Money

```
NEVER A FLOAT. INTEGER MINOR UNITS AND A CURRENCY, ALWAYS TOGETHER.
```

Run in this project's own D1:

```
0.1 + 0.2          →  0.30000000000000004
0.1 + 0.2 = 0.3    →  0  (false)
ROUND(0.615, 2)    →  0.61   ← not 0.62; 0.615 is really 0.6149999… in binary
```

D1 is SQLite, so `REAL` is an IEEE-754 double, and **SQLite has no fixed-point
decimal type** — its `NUMERIC` is a type *affinity*, not `DECIMAL(10,2)`. There is
nothing to store money in safely except `INTEGER`.

Shopify already protects you: in the Admin schema `Decimal` is *"a signed decimal
number, which supports arbitrary precision and is **serialized as a string**"*.
They send `"29.99"` deliberately. `parseFloat` throws that away.

```ts
import { fromMoneyV2, add, allocate, formatMoney, toMoneyV2 } from "~/money";

// IN — the automatic transform from Shopify
const price = fromMoneyV2(node.priceSet.shopMoney);   // Result<Money, MoneyError>

// COMPUTE — integers throughout, mismatched currencies refused
const total = add(price.value, shipping);

// SPLIT — never loses a unit
allocate(total.value, [1, 1, 1]);   // 334, 333, 333 — not 333, 333, 333

// OUT
formatMoney("de-DE", total.value);  // "19,99 €"
toMoneyV2(total.value);             // { amount: "19.99", currencyCode: "EUR" }
```

| Guard | Why |
| ----- | --- |
| Branded `MinorUnits` | `formatMoney(locale, 19.99, "USD")` cannot typecheck — it would render `$0.20` |
| Digit-string parsing | `Number("0.615")` is *already* `0.6149999…`; rounding afterwards cannot recover it |
| Decimals from `Intl` | JPY/KRW/VND have **0**, KWD/BHD/JOD have **3**. `* 100` is wrong ~20 currencies of the time |
| `toCurrency` checks membership | `Intl.NumberFormat` accepts any 3-letter code and uses it as the symbol, so `"ZZZ"` passes |
| Precision loss **refused** | Shopify's own docs use `"29.999"`. Truncating loses a tenth of a cent per line |
| `applyRate` demands a rounding mode | No universally correct choice; a silent default becomes unexplained variance |
| `allocate` uses largest-remainder | Dividing $10 three ways and rounding gives $9.99. Property-tested over 1000+ inputs |
| `money("total")` column helper | Emits `INTEGER` + currency, so nobody can reach for `real()` |

Full contract: `.claude/rules/money.md`.

## Notifications

One funnel, so nothing can be sent without leaving a record — and one decision
layer, so nothing can be sent that a recipient asked not to receive.

```
app/notifications/
├── types.ts                  Message + SendOutcome (discriminated unions), Channel, Policy
├── catalogue.ts              event metadata — CLIENT-SAFE, no renderers
├── dispatch.server.ts        dedupe → policy → reserve → send → settle
├── notify.server.ts          the one call sites use
├── eligibility/
│   ├── types.ts                BlockReason, ChannelDecision, EligibilityRule
│   ├── rules.ts                the rule chain — PURE
│   ├── resolve.ts              runs the chain — PURE
│   └── snapshot.server.ts      the only I/O in the layer
└── channels/email/           transport only

app/emails/                   React Email — the templates
├── tokens.ts                 palette mirroring the site's SCSS (test-enforced)
├── layout.tsx                THE layout + P / Muted / Cta
├── render.ts                 renderEmail() → { subject, html, text }
├── registry.server.ts        event → builder, mapped so a missing one fails the build
└── templates/                one file per notification
```

### The patterns, and what each one buys

| Pattern | Where | What it prevents |
| ------- | ----- | ---------------- |
| **Discriminated union** | `Message`, `SendOutcome`, `ChannelDecision` | One medium's fields leaking into another; `error` being readable on a success |
| **Strategy + Registry** | `REGISTRY` / `HANDLERS` in `dispatch.server.ts` | `dispatch` changing every time a channel is added |
| **Exhaustive mapped type** | `HANDLERS`, `BUILDERS`, `EVENTS` | A **silent no-send** — a missing renderer that throws nothing and delivers nothing |
| **Chain of Responsibility** | `eligibility/rules.ts` | Four different questions collapsing into one `if` nobody can extend |
| **Functional core / imperative shell** | pure `rules.ts` + `snapshot.server.ts` | N queries per decision; a gating layer that needs a database to test |
| **Port & Adapter** | `NotificationSettingsRepo` behind the snapshot | The decision logic knowing about Drizzle |
| **Idempotency guard** | `dedupeKey` in `dispatch` | A retried queue job notifying twice |
| **Reserve → settle** | `NotificationLogRepo` | A crash mid-send leaving a delivered message with no row |
| **Template method** | `EmailLayout` + `P` / `Muted` / `Cta` | Hand-built HTML drifting per template |

### The four questions, kept separate

"Is it enabled?" is really four questions that behave differently:

| Question | Rule | Bypassable by an `essential` event? |
| -------- | ---- | ---------------------------------- |
| **Capability** — can this channel send at all? | `channel_unavailable` | **No** — essential cannot conjure a transport |
| **Reachability** — do we hold an address? | `recipient_unreachable` | **No** |
| **Consent** — has the recipient said no? | `recipient_opted_out` | **Never.** Legal, not a preference |
| **Preference** — did the tenant select this channel? | `not_selected` | **Yes** — the recipient asked for this message |

That last column is a `bypassableByEssential` boolean on each rule, so the
exemption cannot be applied to the wrong question by accident. A password reset
ignores a tenant's settings; it does **not** ignore an opt-out.

Order is a product decision, not an optimisation: "email is not configured" is
actionable, "this event is not selected for email" is baffling to someone who
never set email up. So capability is reported first and the tenant's own choice
last.

### Preferences are a channel SELECTION, not a boolean

"Email on every status change, SMS only when it is ready" is the normal shape of
this requirement — and on a metered channel it is a cost decision too. So the
stored unit is (scope, event, channel) → enabled.

**Absence is the default, and absent is not empty.** No rows for an event means
"no preference" and falls back to the event's declared channels — which is what
lets this ship without changing any existing tenant's behaviour. An explicit row
with `enabled = false` is different: the tenant turned that channel off, and
`clearPreference()` exists precisely so you can return to unset rather than
storing everything off.

Stored **relationally, not as a JSON blob.** A blob needs a defensive parser, a
"what if it is corrupt" policy, and a migration whenever its shape changes — and
one hand-edited value can take down every send for that tenant.

**Opt-outs are keyed on the ADDRESS, not on a customer id.** Someone who replies
STOP or clicks unsubscribe is silencing that address, and it has to stay silenced
on records created later. Keying on an entity means the same phone number keeps
being texted from a different row — a bad experience, and for SMS a carrier
violation. `scope: "global"` silences an address app-wide.

### Adding a notification

1. Add the key to `NotificationEvent` (`notifications/types.ts`).
2. Add a spec to `catalogue.ts` — audience, gate, channels.
3. Add props and a builder, and register it in `emails/registry.server.ts`.

Steps 2 and 3 are not optional: both objects are typed `Record<NotificationEvent, …>`,
so the build fails until they exist. The failure being prevented is a **silent
no-send** — with a plain lookup returning `undefined`, the notification never
arrives and nothing throws.

```ts
const result = await notify({
  event: "admin_password_reset",
  to: { email: user.email },
  dedupeKey: `admin_password_reset:${hash}`,
  payload: { recipientName: user.name, resetUrl, expiresIn: "one hour" },
});

result.decisions; // every channel considered, with its verdict
```

`decisions` is returned even for the channels that *were* sent, because "why
didn't they get the text?" is the question this system is asked most, and a
function that only reports what it sent cannot answer it.

### Adding a channel

Add the message shape to `Message`, add a `Channel`, add a `REGISTRY` entry and a
`HANDLERS` entry, and extend `availableChannels()`. `HANDLERS` is keyed
`[K in Message["kind"]]`, so the build fails until the handler exists.
**`dispatch` and the eligibility rules never change.**

### Templates are React, never HTML strings

Every email composes the single `EmailLayout` plus its primitives. `renderEmail`
produces the HTML **and** the plain-text part from the same JSX, so the two cannot
drift and no message ships HTML-only (which essentially every spam filter
penalises). The `Cta` shows the raw URL under the button: clients strip button
backgrounds, and a button with no text URL is a dead word in the text part.

**Why not SCSS here:** email clients strip `<style>` blocks and ignore external
stylesheets and CSS custom properties — every rule has to be an inline attribute,
so there is no stylesheet for SCSS to compile into. `emails/tokens.ts` holds the
literal values instead, and `emails/tokens.test.ts` reads
`app/styles/public/_tokens.scss` and **fails the build when an email colour no
longer matches the site's**.

### What the log gives you

`notification_logs` gets one row per attempt: `queued → sent | failed | refused`.

- **`refused` is distinct from `failed`** — "we declined to try" is not "we tried and it broke".
- **`reasonCode` is its own column**, from a closed union, not a token prefixed onto prose. Prose gets improved; a parser over it breaks the first time someone does.
- **`providerStatus` is separate from `status`** — ours means the API accepted it, the provider's means it believes it was delivered.
- **The row is reserved BEFORE the send**, so a crash in between is a visible stuck `queued` row rather than a delivered message with no record.
- **Dedupe matches `queued` too**, so two workers cannot both notify while neither has settled.
- **A retriable failure throws** (`RetryableNotificationError`) so a queue retries it; a permanent one returns normally.

## Translations

**Every user-visible string is translated — public pages and the embedded admin
alike.** A hardcoded English string is a defect, like a hardcoded hex colour.

```
app/i18n/
├── config.ts                supported locales, labels, direction, narrowing
├── options.ts               i18next options shared by server + client
├── resources.ts             static JSON imports (workerd has no filesystem)
├── i18n.server.ts           locale detection
├── useLocale.ts             the render's locale, read from i18next
├── format.ts                Intl date / number / money / list helpers
├── i18next.d.ts             types t() against the en files
└── locales/{en,es}/{common,public,admin}.json
```

Namespaces split by surface, so the admin bundle never ships marketing and legal
copy. A route declares what it needs:

```ts
export const handle = { i18n: ["common", "admin"] };
```

### Where the locale comes from

| Priority | Source |
| -------- | ------ |
| 1 | **`?locale=` — Shopify's own parameter.** Authoritative in the embedded admin |
| 2 | `?lng=` — explicit switch on the public pages |
| 3 | `locale` cookie — remembered public choice |
| 4 | `Accept-Language` |
| 5 | `en` |

Apps rendered in the Shopify admin receive the merchant's chosen locale in the
`locale` request parameter, so the embedded app follows the language the merchant
already picked in Shopify. **Never add a language switcher to the admin** — it
would let the app disagree with the Shopify chrome around it. The switcher is
public-only, and persists to a cookie so the *server* renders the next request in
the right language.

Shopify sends regional tags (`es-ES`), so everything narrows through
`toLocale()`, which falls back to the base language. A strict equality check
would silently serve English to a Spanish merchant.

### Formatting is part of translation

`1/2/2026` is January 2nd in `en` and February 1st in `es`; `1,5` is
one-and-a-half in `es` and one thousand five hundred in `en`. **Never hand-format
a date, number, currency, list, or relative time** — use `app/i18n/format.ts`.
`formatMoney(locale, minorUnits, currency)` takes integer minor units and derives
the divisor from the currency, so JPY (0 decimals) and KWD (3) are right without
a special case.

### Adding a locale

Add the code to `config.ts`, add `locales/<code>/*.json`, register them in
`resources.ts`. The suite then enforces **identical key sets, no empty strings,
and identical `{{interpolation}}` placeholders** across every locale — a renamed
placeholder renders literal braces to a merchant, so it fails the build.

Full contract: `.claude/rules/i18n.md`.

## Styling

Two surfaces, two systems, and they must not mix:

| Surface | Styled with |
| ------- | ----------- |
| Public pages | **SCSS** — `app/styles/public/` |
| Embedded admin (`/app/**`) | **Polaris web components** + App Bridge |

Each stylesheet is loaded by exactly one layout's `links()`, never from
`root.tsx` — that is what stops the public CSS reset reaching the Polaris iframe.

`app/styles/public/_tokens.scss` is the single source of colour, spacing, type,
radius, shadow, breakpoint and motion. Colours are CSS custom properties (so
light/dark swap at runtime); sizes and breakpoints are Sass maps reached through
`m.space()`, `m.text()` and `m.mq()`, which fail the build on a typo. **A literal
hex, spacing value, or breakpoint inside a page is a defect.**

Dark mode is defined in three layers — full light palette on `:root`, the OS
preference guarded so an explicit light choice wins, and an explicit
`[data-theme="dark"]` override. `:focus-visible` rings, a skip link, reduced-motion
handling, and logical properties for RTL are all in the base.

Full contract: `.claude/rules/styling.md`.

There is no `process.env` in workerd. Config arrives as the `env` binding, so
routes read it with `getEnv()` and build the Shopify app with
`createShopify(getEnv())` — never a module-level singleton, because one isolate
is reused across shops and module state would leak between tenants.

## Scripts

| Command                  | Does                                              |
| ------------------------ | ------------------------------------------------- |
| `npm run dev`            | `shopify app dev` against the dev app + tunnel     |
| `npm run dev:local`      | Vite only, no tunnel or Shopify CLI                |
| `npm run precommit`      | typecheck + lint — the **pre-commit** hook, ~5s     |
| `npm run verify`         | typecheck + lint + test — the **pre-push** hook, ~35s |
| `npm run db:generate`    | Drizzle schema → a new migration in `./drizzle`    |
| `npm run db:migrate:local` | Apply migrations to local D1                    |
| `npm run cf-typegen`     | Regenerate `worker-configuration.d.ts` (`Env`)     |
| `npm run cf:deploy`      | Verify, production build, migrate, deploy          |
| `npm run install:skill`  | Install every AI-agent skill, for every agent host |
| `npm run check:placeholders` | Fail if production bindings still hold `REPLACE_ME` ids |

## Operating and adopting a derived app

The template separates reusable implementation from decisions that belong to
the app owner. Before a launch, complete the
[adoption checklist](docs/ADOPTING_THE_TEMPLATE.md), including legal copy,
Shopify configuration, billing, AI policy, customer-data handling, resources,
alerts, and App Store self-review. For production deployment, rollback, D1
recovery, scheduled cleanup, secret rotation, and webhook DLQ procedures, use
the [operations runbook](docs/OPERATIONS.md).

Two generated files are committed on purpose:

- **`worker-configuration.d.ts`** — a fresh fork has to typecheck before anyone
  has run `cf-typegen`. Regenerate it after every `wrangler.jsonc` change; never
  hand-edit `Env`.
- **`package-lock.json`** — what makes the pinned versions reproducible, and what
  `npm ci` needs in CI.

## Dependency overrides — do not remove

`package.json` carries two `overrides`. Both fix real advisories in **transitive
dev-only** dependencies, and `npm audit` reports **0 vulnerabilities** with them
in place.

| Override | Fixes |
| -------- | ----- |
| `@esbuild-kit/core-utils` → `esbuild ^0.25.12` | `drizzle-kit` still pulls the deprecated `@esbuild-kit/esm-loader` ("merged into tsx") *alongside* `tsx`, and only that legacy chain drags in esbuild 0.18 — GHSA-67mh-4wv8-2f99. Pinned to the line drizzle-kit already resolves, so npm dedupes to one copy. |
| `@shopify/graphql-codegen` → `lodash ^4.18.1` | `@shopify/api-codegen-preset` → `@graphql-codegen/*` pin lodash 4.17.x — GHSA-r5fr-rjxr-66jc (code injection via `_.template`) and GHSA-f23m-r3pf-42rh (prototype pollution). 4.18.1 is the patched line. |

**Never run `npm audit fix --force` in this repo.** It "fixes" these by
*downgrading* `drizzle-kit` to 0.18.1 and `@shopify/api-codegen-preset` to 0.0.4
— years-old majors that would break the schema and codegen pipelines. That is
the tool trading your working build for a clean report.

Both overrides are verified by running the tools that consume them, not by
trusting the audit number: `npm run db:generate` exercises the esbuild-kit path,
and `npm run graphql-codegen` exercises every `@graphql-codegen` package.

## Links are built in one place

`app/urls.ts` is the only place a path is constructed. A link is used from more
places than it looks — a route, a redirect, a nav item, an email body, a test —
and each one that builds its own string is a copy that can drift. A link inside an
**email** cannot be corrected after sending, so a drift there is permanent for
everyone who already received it.

Relative paths come from `paths.*`; `absolute(origin, path)` takes the origin from
the incoming request, so a link always points at the deployment the recipient is
actually using. Reading the origin from config is how a dev tunnel URL ends up in
a production email.

## Conventions for agents

`AGENTS.md` is the single contract — no cheating, strict TDD, CLEAN rings,
Cloudflare invariants, and "never write Shopify code from memory". `CLAUDE.md` is
a one-line pointer at it, so there is no second copy to keep in sync. The
detailed rules live in `.claude/rules/`.
