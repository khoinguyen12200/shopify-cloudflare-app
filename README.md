# shopify-cloudflare-app

Scaffold for Shopify apps on Cloudflare Workers. Fork it, run two commands, and
start building — nothing app-specific is in here.

## Stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Runtime    | Cloudflare Workers (workerd), via `@cloudflare/vite-plugin` |
| Framework  | React Router 7 (SSR) + Vite 8                             |
| Shopify    | `@shopify/shopify-app-react-router` v2, Admin API 2026-10  |
| Admin UI   | Polaris **web components** + App Bridge                    |
| State      | D1 + Drizzle (`app/db/`, queried only in `app/models/`)   |
| Sessions   | Workers KV (`app/session-storage.server.ts`)              |
| Tests      | Vitest + `@cloudflare/vitest-pool-workers` (real workerd) |

Dev runs in workerd with real D1/KV bindings under Miniflare, so local
behaviour matches production.

## First run on a fork

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

Then set the production `client_id` into `wrangler.jsonc`
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
its own app in the Dev Dashboard:

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
app/request-context.server.ts      AsyncLocalStorage: getEnv() / getDb()
app/shopify.server.ts              createShopify(env) — per-request, no module state
app/session-storage.server.ts      KV-backed Shopify SessionStorage
app/db/schema.ts                   Drizzle schema → ./drizzle migrations
app/models/                        The ONLY layer that touches Drizzle; shop-scoped
app/routes/                        flatRoutes
```

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

## Conventions for agents

`AGENTS.md` is the single contract — no cheating, strict TDD, CLEAN rings,
Cloudflare invariants, and "never write Shopify code from memory". `CLAUDE.md` is
a one-line pointer at it, so there is no second copy to keep in sync. The
detailed rules live in `.claude/rules/`.
