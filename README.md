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
npm install
npm run install:skill               # AI-agent skills, for every agent host
cp .dev.vars.example .dev.vars      # fill in SHOPIFY_API_SECRET

# Create your own Shopify apps — one for dev, one for prod (see below)
npm run config:link:dev
npm run config:link:prod

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
(`env.production.vars.SHOPIFY_API_KEY`) and `SHOPIFY_APP_URL`, and
`npx wrangler secret put SHOPIFY_API_SECRET --env production`.

## AI-agent skills

```bash
npm run install:skill                          # install/refresh everything
npm run install:skill -- --locked              # exact versions from skills-lock.json
npm run install:skill -- --agent claude-code   # one host only
```

`skills-lock.json` is committed and lists every skill package this repo uses.
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
/internal/profile     change your own name and password
/internal/logout
```

`admin_users` is **the one table that is not shop-scoped** — internal staff are
your team, not a merchant's records. Everything else stays shop-scoped.

### Signing in locally

`npm run dev` applies migrations and seeds a local admin automatically:

| | |
| --- | --- |
| URL | `http://localhost:3000/internal/login` |
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
| `npm run verify`         | typecheck + lint + test (what the pre-commit hook runs) |
| `npm run db:generate`    | Drizzle schema → a new migration in `./drizzle`    |
| `npm run db:migrate:local` | Apply migrations to local D1                    |
| `npm run cf-typegen`     | Regenerate `worker-configuration.d.ts` (`Env`)     |
| `npm run cf:deploy`      | Verify, production build, migrate, deploy          |
| `npm run install:skill`  | Install every AI-agent skill, for every agent host |

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

## Conventions for agents

`AGENTS.md` is the single contract — no cheating, strict TDD, CLEAN rings,
Cloudflare invariants, and "never write Shopify code from memory". `CLAUDE.md` is
a one-line pointer at it, so there is no second copy to keep in sync. The
detailed rules live in `.claude/rules/`.
