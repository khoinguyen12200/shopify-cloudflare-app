# Upgrading

Sections are newest first. Each says **affected if**, gives a **checklist** you can follow mechanically,
and marks the steps that are **risky for an app already in production**.

---

## 2026-10-09 template modernisation (Node 24, dependencies, Admin API 2026-10, workerd)

Verified on this template, Node 24.21.0, npm 11.19: `npm run verify` (typecheck + lint + 27 `node --test`
tests + 197 vitest files / 1642 tests), `npx vitest run --sequence.shuffle.files`, `CLOUDFLARE_ENV=production
npx vite build`, `wrangler deploy --dry-run` (Total Upload 5546 KiB, 1270 KiB gzip), and a dev-server smoke
test all pass. Not verifiable without a real store or account: a deploy, token exchange and offline-token
refresh against Shopify, webhook delivery under 2026-10, and the GitHub Actions run (see each section).

Apply the sections **in this order**, running `npm run verify` after each, so a failure points at one change.
Sections 1 to 3 are tooling only and cannot change production behaviour. Sections 4 and 5 can.

| Order | Section | Production risk |
|---|---|---|
| 1 | Node 24, `engines`, `.nvmrc`, CI | None at runtime (tooling and CI only) |
| 2 | In-range dependency bumps | Low: `react`, `zod`, `drizzle-orm`, `ai` ship to the Worker |
| 3 | Major upgrades (`@cloudflare/vitest-plugin`, `vitest` 5, `jsdom` 30, `@shopify/cli` 4.9) and blocked ones | None at runtime (test tooling and CLI) |
| 4 | Shopify Admin API / webhooks to 2026-10 | **Yes**: webhook payload version changes on the next `shopify app deploy` |
| 5 | wrangler, `compatibility_date`, observability | **Yes**: runtime behaviour and log content |
| 6 | Best-practice changes (tsconfig, CI, Dependabot, tests) | None at runtime |

### 1. Node 24

**Affected if** your `package.json` `engines.node`, `.nvmrc` or CI Node version is older than the Node 24 line,
or `@types/node` is not 24.x. Every app copying this template is affected.

Why: Node 24 is the Active LTS line (`https://nodejs.org/dist/index.json` lists 24.21.0 "Krypton" as the
newest LTS on 2026-10-09; Node 26 is not LTS yet). Both Shopify libraries need Node >= 22.0.0.
`remix-i18next` 8, `react-router` 8 and `@react-router/dev` 8 need >= 22.22.0 (not installed, see section 3).
`jsdom` 30 needs `^22.22.2 || ^24.15.0 || >=26`. Every installed dependency's `engines.node` was checked
with a script over `package-lock.json` against Node 24.14.0 and 24.0.0; the only mismatches are
`@img/sharp-win32-ia32` (an optional Windows 32-bit binary, never installed on Linux/macOS/x64) and
`@napi-rs/lzma-linux-x64-gnu` (`^22.20 || ^24.12 || >=25`, which excludes 24.0 to 24.11 only).

```diff
 # package.json
-    "node": ">=20.19 <22 || >=22.12"
+    "node": ">=24.15"
-    "@types/node": "^26.2.0",
+    "@types/node": "^24.19.1",
```

```diff
 # .nvmrc  (the whole file)
-24.14.0
+24
```

```diff
 # .github/workflows/ci.yml
-      - uses: actions/checkout@v5
+      - uses: actions/checkout@v7
-      - uses: actions/setup-node@v5
+      - uses: actions/setup-node@v7
```

Why these CI majors: `gh api repos/actions/checkout/releases/latest` is v7.0.1, `.../setup-node/...` is v7.1.0
(published 2026-10-08, one day old: pin to the `v7` tag and let Dependabot move it). setup-node v7 is ESM
and removed the dummy `NODE_AUTH_TOKEN` export; this repo publishes nothing, so neither matters. The workflow
still reads `node-version-file: .nvmrc`, which now says `24` (latest 24.x). Nothing in the repo names a
Cloudflare Workers Builds Node image; if your app uses Workers Builds, it reads `.nvmrc`/`NODE_VERSION`.

`@types/node` is deliberately **24**, not the registry latest (26.6.4): the types must match the runtime the
tooling runs on, and `vitest` 5 accepts `@types/node ^22 || >=24`.

Checklist:

1. Install Node >= 24.15 locally (`nvm install 24 && nvm use`). `.npmrc` has `engine-strict=true`, so
   `npm install` on 24.14 now **fails** because `jsdom` 30 needs 24.15: the error names the package.
2. Apply the three diffs above, then `rm -rf node_modules && npm install && npm run verify`.
3. `grep -rn "node-version\|NODE_VERSION\|nvmrc" .github` and any Dockerfile or CI config you added; align them.
4. Update README/docs that quote a Node version. This template's README stack table now says
   "tooling on Node 24 LTS (`.nvmrc`, `engines >=24.15`)".

Production risk: none at runtime. The Worker runs on workerd, not Node. CI and every developer machine must
be on Node >= 24.15 before they next run `npm install`.

### 2. In-range dependency bumps (minor and patch)

**Affected if** you copied this template at the "Before" versions. Update the ranges in `package.json`
(not only the lockfile: `npm update` alone left `ai`, `react-router`, `@ai-sdk/provider` and `wrangler`
ranges behind, so check the diff) and run `npm install`.

| Package | Range before | Range after | Installed before | Installed after |
|---|---|---|---|---|
| `@ai-sdk/provider` | ^4.0.8 | ^4.0.26 | 4.0.8 | 4.0.26 |
| `@ai-sdk/react` | ^4.0.82 | ^4.0.139 | 4.0.82 | 4.0.139 |
| `@cloudflare/vite-plugin` | ^1.53.1 | ^1.63.1 | 1.63.1 | 1.63.1 |
| `@react-router/dev` | ^7.18.2 | ^7.18.4 | 7.18.2 | 7.18.4 |
| `@shopify/polaris-types` | ^1.0.7 | ^1.1.0 | 1.0.7 | 1.1.0 |
| `@testing-library/react` | ^16.3.2 | ^16.3.3 | 16.3.2 | 16.3.3 |
| `@types/react` | ^19.2.18 | ^19.3.0 | 19.2.18 | 19.3.0 |
| `@types/react-dom` | ^19.2.5 | ^19.3.0 | 19.2.5 | 19.3.0 |
| `ai` | ^7.0.79 | ^7.0.136 | 7.0.79 | 7.0.136 |
| `drizzle-kit` | ^0.31.10 | ^0.31.11 | 0.31.10 | 0.31.11 |
| `drizzle-orm` | ^0.45.2 | ^0.45.4 | 0.45.2 | 0.45.4 |
| `eslint` | ^10.9.0 | ^10.12.0 | 10.9.0 | 10.12.0 |
| `globals` | ^17.5.0 | ^17.13.0 | 17.11.0 | 17.13.0 |
| `graphql-config` | ^5.1.6 | ^5.1.8 | 5.1.8 | 5.1.8 |
| `i18next` | ^26.4.0 | ^26.4.2 | 26.4.0 | 26.4.2 |
| `isbot` | ^5.2.1 | ^5.2.2 | 5.2.1 | 5.2.2 |
| `lucide-react` | ^1.33.0 | ^1.54.0 | 1.33.0 | 1.54.0 |
| `prettier` | ^3.9.6 | ^3.9.9 | 3.9.6 | 3.9.9 |
| `react`, `react-dom` | ^19.2.8 | ^19.3.0 | 19.2.8 | 19.3.0 |
| `react-i18next` | ^17.0.12 | ^17.0.16 | 17.0.12 | 17.0.16 |
| `react-router` | ^7.18.2 | ^7.18.4 | 7.18.2 | 7.18.4 |
| `sass-embedded` | ^1.103.1 | ^1.105.1 | 1.103.1 | 1.105.1 |
| `skills` | ^1.5.23 | ^1.7.1 | 1.5.23 | 1.7.1 |
| `typescript-eslint` | ^8.67.0 | ^8.71.1 | 8.67.0 | 8.71.1 |
| `vite` | ^8.2.2 | ^8.3.4 | 8.2.2 | 8.3.4 |
| `wrangler` | ^4.125.0 | ^4.149.0 | 4.149.0 | 4.149.0 |
| `zod` | ^4.4.3 | ^4.6.5 | 4.4.3 | 4.6.5 |

No source change was needed for any of these: typecheck, lint and all 1642 tests passed unchanged after the
bump. One new notice appears in tool output after these bumps and is not an error: Vite 8.3 prints
`The envFile option is deprecated, please use envDir: false instead.` three times. It originates in
`@react-router/dev` 7.18.4 (`dist/vite/cloudflare.js`), not in this repo; it goes away with a React Router
release that stops setting it.

Checklist: edit ranges to the "after" column, `npm install`, `npm run verify`, `CLOUDFLARE_ENV=production npx vite build`.

Production risk: `react`/`react-dom` 19.3, `zod` 4.6, `drizzle-orm` 0.45.4, `ai` 7.0.136 and `i18next` ship in the
Worker bundle. Run the suite, deploy to a staging Worker first, and load `/app` in a development store.

### 3. Major upgrades and the ones that are blocked

Each was attempted on its own, with `npm run verify` after it (and a one-step rollback checkpoint).

#### 3a. `@cloudflare/vitest-pool-workers` 0.22 -> `@cloudflare/vitest-plugin` 1.4 (a rename)

**Affected if** `devDependencies` has `@cloudflare/vitest-pool-workers` (every app built from this template).
The old name is **deprecated** (`0.23.0`: "has been renamed to @cloudflare/vitest-plugin. This package will not
receive future updates") and supports `vitest ^4.1` only. `@cloudflare/vitest-plugin` 1.4.0 supports
`vitest ^4.1.0 || ^5.0.0` and depends on the same `wrangler`/`miniflare` as the top-level `wrangler`, so
there is now **one** wrangler and **one** miniflare in the tree (before: a nested `wrangler@4.124.0`).

The API this template uses (`cloudflareTest`, `readD1Migrations`, `projects`, `isolate: false`, a stub `main`,
`remoteBindings: false`, `miniflare.outboundService`) did not change.

```bash
npm uninstall @cloudflare/vitest-pool-workers
npm install -D @cloudflare/vitest-plugin@^1.4.0
# Cloudflare also publishes a codemod; by hand it is exactly these four edits:
```

```diff
 // vitest.config.ts
 import {
   cloudflareTest,
   readD1Migrations,
-} from "@cloudflare/vitest-pool-workers";
+} from "@cloudflare/vitest-plugin";
```

```diff
 // tsconfig.json  compilerOptions.types
-      "@cloudflare/vitest-pool-workers/types"
+      "@cloudflare/vitest-plugin/types"
```

Also rename in `app/test/env.d.ts` (a comment), `README.md`, and `.github/workflows/ci.yml` (a comment).
Find them all with `rg "vitest-pool-workers" --glob '!package-lock.json'`.
If you wrote tests with MSW: 0.22.0 removed the pool's MSW shims, so MSW must be >= 2.14. This template has no MSW.

#### 3b. `vitest` 4.1 -> 5.0.3

**Affected if** `vitest` is `^4`. Requires Vite >= 6.4 and Node >= 22.12 (met). The migration guide
(https://vitest.dev/guide/migration) lists these breaking changes; this is whether each hits a repo like ours:

| Vitest 5 change | Affects you if | Here |
|---|---|---|
| `clearMocks` now defaults to `true` | Tests rely on `vi.fn()` call history surviving between tests | Not affected: suite green unchanged |
| `extends` defaults to `true` for inline `projects` | Inline projects were meant to NOT inherit the root config | Not affected: the root config has no `test` options besides `projects` |
| New `sharedViteServer` (one Vite server for inline projects; plugin `config` hooks run once, not per project) | Per-project plugins that rely on running `config` per project | Not affected; `cloudflareTest` is declared in one project |
| `vi.mock`/`vi.hoisted` inside functions throw instead of warn | Calls inside `describe`/`it` | Not affected |
| `test.sequential` / `describe.sequential` / `sequential` removed | `rg "\.sequential"` | Not affected |
| Unawaited `resolves`/`rejects` fail the test | A forgotten `await expect(...).resolves` | Not affected |
| `toThrow('')` matches any message | Empty-string `toThrow` | Not affected |
| Fake timers mock `Temporal` | Tests that use `Temporal` with fake timers | Not affected |
| `bench` removed from imports; `benchmark.*` options removed | `vitest bench` | Not used |
| Artifact/report paths moved under `.vitest/`; JSON/JUnit reporters write files | CI uploads reporter output | Not used |
| Entry points `vitest/coverage`, `vitest/reporters`, `vitest/environments`, `vitest/snapshot`, `vitest/runners`, `vitest/suite`, `vitest/mocker` removed | `rg "from \"vitest/"` | Only `vitest` and `vitest/config` are imported |
| Config files are no longer searched in parent directories | Monorepo | Not affected |

```bash
npm install -D vitest@^5.0.3
```

Result here: no config or test change; the suite ran in 1:30 instead of 2:22. Vitest 5 prints a hint that
`isolate: false` would be ~5 s faster for the `unit` project. It was **not** taken: unit tests here were
written assuming isolation, and the speed gain is small.

#### 3c. `jsdom` 29 -> 30.1.2 and `@types/jsdom` 28 -> 30

**Affected if** `jsdom` is `^29` (it is the `dom` project's environment). `jsdom` 30 declares
`engines.node ^22.22.2 || ^24.15.0 || >=26`, which is why section 1 sets `engines` to `>=24.15`. `@types/jsdom`
30 matches `jsdom` 30; keep the two majors in step. No source change.

```bash
npm install -D jsdom@^30.1.2 @types/jsdom@^30.0.0
```

#### 3d. `@shopify/cli` 4.8.4 -> 4.9.0

**Affected if** `@shopify/cli` is pinned at 4.8.x. The template pins it **exactly** (`"4.9.0"`, no caret) so
every developer and CI runner uses one CLI; keep that.

```diff
-    "@shopify/cli": "4.8.4",
+    "@shopify/cli": "4.9.0",
```

`node_modules/.bin/shopify version` prints `4.9.0`; `npm run verify` is green. `shopify app dev`,
`shopify app deploy` and `shopify app config validate` were **not run** (they need a linked app and login).
After upgrading run `npm run shopify -- app config validate` against your linked app before deploying.
The `@shopify/cli` GitHub release page could not be read reliably through the tooling here, so the 4.9.0
breaking-change list is **unverified**: read https://github.com/Shopify/cli/releases before adopting.

#### 3e. Blocked, kept on the previous major (do not force these)

| Package | Tried / latest | Blocker (verified with `npm view <pkg> peerDependencies` on 2026-10-09) | When to revisit |
|---|---|---|---|
| `react-router`, `@react-router/dev` 7.18.4 -> 8.4.0 | latest 8.4.0 | `@shopify/shopify-app-react-router` 3.0.2 (its latest; dist-tag `latest`, no `next`) declares peer `react-router ^7.6.2` | When `@shopify/shopify-app-react-router` publishes a release whose peer range admits 8. Do **not** use `--legacy-peer-deps` or `overrides`: the library's `authenticate`/`boundary` code is built against v7 |
| `remix-i18next` 7.5.0 -> 8.0.0 | latest 8.0.0 | Peer `react-router ^8.0.0`, so it moves with react-router. Its v8 changes (read in the project's release notes): needs Node >= 22.22; middleware imported from the package root; `server`/`client`/`react` subpath exports removed (this repo imports `remix-i18next/server` in `app/i18n/i18n.server.ts`); `RemixI18Next` class replaced by `createI18nextMiddleware`; `findLocale` callbacks receive middleware args | With react-router 8 |
| `typescript` 6.0.3 -> 7.0.2 | latest 7.0.2 (native compiler) | `typescript-eslint` 8.71.1 (and its canary 8.71.2-alpha.1) peers `typescript >=4.8.4 <6.1.0`; `@react-router/dev` 7.18.4 peers `typescript ^5.1.0 \|\| ^6.0.0` | When `typescript-eslint` supports TS 7. Lint is a verify gate and cannot run without it |
| `@types/node` 24 -> 26 | latest 26.6.4 | Deliberate: types must match the Node 24 runtime (section 1) | When `.nvmrc` moves to Node 26 (LTS from late October 2026) |

Vitest 5 itself was **not** blocked: the blocker was `@cloudflare/vitest-pool-workers` 0.23 (peer
`vitest ^4.1.0`), which the 3a rename removed.

### 4. Shopify Admin API and webhooks: 2026-07 -> 2026-10

**Affected if** `app/shopify.server.ts` says `ApiVersion.July26` or either `shopify.app*.toml` says
`api_version = "2026-07"`. These are **one decision**: change all of them together, in one commit.

Evidence (see `.claude/rules/shopify-api-invariants.md`, section dated 2026-10-09):

* 2026-10 is the **latest stable** release (2026-10-01), accessible until 2027-10-16 15:00 UTC; 2027-01 is the
  release candidate (https://shopify.dev/docs/api/usage/versioning). `ApiVersion.October26 = "2026-10"` exists in
  the installed `@shopify/shopify-api` 15.
* Release notes (https://shopify.dev/changelog/release-notes/2026-10) read in full. The breaking or
  action-required items are in customers (segment query syntax, SMS marketing consent), orders (shipping-address
  tax recalculation, removed `PriceRule`/`DraftOrderDiscountNotAppliedWarning.priceRule`), metafield filters
  (invalid filters now error), `ProductVariant.barcode` (deprecated), inventory (`ITEM_NOT_STOCKED_AT_LOCATION`
  removed), Customer Account API (`lastIncompleteCheckout` removed), POS UI (`staffMemberId` removed). Webhook
  payload changes are additive (`selling_plan_id`, `inventory_transfer_id`). Nothing touches `shop`,
  `shop.ianaTimezone` or `currentAppInstallation.app`, the only Admin operations in this template.
* Every Admin operation in `app/` was validated against 2026-10 with the toolkit's `validate.mjs`
  (all five valid).

**Search your app** for anything in those lists: `rg "priceRule|PriceRule|lastIncompleteCheckout|staffMemberId|ITEM_NOT_STOCKED_AT_LOCATION|\.barcode|smsMarketing|segment"`. If you
query those areas, read the release notes and migrate before moving.

Files changed (this repo):

| File | Change |
|---|---|
| `app/shopify-api-version.ts` (new) | `export const apiVersion = ApiVersion.October26;` the single in-code source |
| `app/shopify.server.ts` | imports `apiVersion` from `./shopify-api-version`; the local `export const apiVersion = ApiVersion.July26` and the `ApiVersion` import are removed |
| `app/shopify.server.test.ts` | imports `apiVersion` from `./shopify-api-version`; expects `"2026-10"` |
| `.graphqlrc.ts` | `import { apiVersion } from "./app/shopify-api-version"` (was `./app/shopify.server`) |
| `shopify.app.toml`, `shopify.app.dev.toml` | `[webhooks] api_version = "2026-10"` |
| `scripts/check-placeholders.mjs`, `scripts/check-placeholders.test.mjs` | webhook version `2026-10` and Partner version `2026-07` are now two separate constants (see below) |
| `README.md` | already said 2026-10; no change |

Why the new `app/shopify-api-version.ts`: `npm run graphql-codegen` was **broken before this change**.
`.graphqlrc.ts` imported `app/shopify.server.ts`, which imports `~/wiring.server`, and the `~` alias is not
resolved by graphql-config, so codegen died with `Cannot find module '~/wiring.server'`. A one-line module with
no app imports fixes it. If your `.graphqlrc.ts` still imports `shopify.server`, codegen is broken for you too.

After the version moves, regenerate the types (gitignored, so nothing to commit):

```bash
rm app/types/admin-2026-10.schema.json     # a stale local copy is reused otherwise
npm run graphql-codegen                    # downloads the 2026-10 stable schema
npm run typecheck
```

**The Partner API stays on 2026-07 (a separate track).** `SHOPIFY_PARTNER_API_VERSION` in `wrangler.jsonc`
(top level **and** `env.production`) and `.dev.vars.example` stay `2026-07`. The toolkit's Partner validator
lists only `unstable, 2026-07, 2026-04, 2026-01, 2025-10, 2025-07` and refuses `2026-10`; both Partner queries
validate on 2026-07. The Partner docs front matter says `api_version: 2026-10`, which contradicts it, so
whether the live endpoint accepts `2026-10` is **unverified**. Do not move it without calling the endpoint.
`scripts/check-placeholders.mjs` previously forced the Partner version to equal the webhook version; it now
checks them separately, and a new test pins the Partner value.

Checklist:

1. Apply the file table; `rm app/types/admin-*.schema.json && npm run graphql-codegen`.
2. `npm run verify`.
3. Add `scripts/check-placeholders.test.mjs` to the `test` script (this template now runs it, see section 6).
4. In a staging/dev app: `npm run deploy:dev`, confirm `app/uninstalled` and `app/scopes_update` still arrive and parse.

**Risky for an app in PRODUCTION:** the webhook API version is part of the *app configuration*, and takes
effect when you run `npm run deploy:prod` (`shopify app deploy`), not when the Worker deploys. After that,
Shopify delivers webhook payloads in the 2026-10 shape (`X-Shopify-Api-Version: 2026-10`). Deploy the Worker
first (it must already tolerate both shapes: this template's schemas are lenient, requiring only used
fields; check yours), then run `shopify app deploy`. Webhook delivery rows store `apiVersion`
(`webhook_deliveries.api_version`), so old queued rows keep `2026-07`. Watch `webhook.*` logs and the DLQ
for a day. Admin GraphQL calls move to 2026-10 when the Worker deploys, because they use `apiVersion` from
code. Roll back by reverting both and redeploying both.

### 5. Cloudflare: wrangler, `compatibility_date`, observability

**Affected if** `wrangler.jsonc` has a `compatibility_date` older than the installed workerd, or an
`observability` block without a sampling rate.

* `wrangler` ^4.149.0. `npx workerd --version` prints `2026-10-06`: that is the newest date the installed
  runtime accepts (wrangler warns about later dates, so do not guess one). `npx wrangler types` then wrote
  `Runtime types generated with workerd@1.20261006.1 2026-10-06 nodejs_compat`.
* Flags that became default between the old date (2026-08-01) and 2026-10-06, per
  https://developers.cloudflare.com/workers/configuration/compatibility-flags/: `nodejs_compat` and
  `nodejs_compat_v2` default on from 2026-08-04 (the explicit flag is redundant but harmless and was kept);
  `durable_object_io_tasks_prevent_eviction` from 2026-10-01 (needs Durable Objects, which this template does
  not use); `throw_on_not_implemented_tls_options` from 2026-06-16 (unsupported `tls.connect` options now
  throw; nothing here passes them). Only the first 100 000 of that page's 117 598 characters were read; the
  rest should be older entries but **was not read**.

```diff
 // wrangler.jsonc
-  "compatibility_date": "2026-08-01",
+  "compatibility_date": "2026-10-06",
 ...
-  "observability": { "enabled": true },
+  "observability": {
+    "enabled": true,
+    "head_sampling_rate": 1,
+    "redact_query_string": true
+  },
 ...   // and the same block inside env.production (observability is NOT inherited)
-      "observability": { "enabled": true },
+      "observability": {
+        "enabled": true,
+        "head_sampling_rate": 1,
+        "redact_query_string": true
+      },
```

`head_sampling_rate: 1` is the default (log everything), written out so lowering it is a visible choice.
`redact_query_string: true` is in wrangler 4.149's `config-schema.json` (description: "Whether query strings are
removed from request URLs in logs and traces", default false). The Workers Logs docs page does not mention it,
so beyond that schema description its behaviour is **unverified**. The reason to set it: an embedded request
carries `id_token` and `hmac` in the query string, and platform invocation logs record the URL. Consequence:
query strings disappear from Workers Logs and traces, which makes debugging by URL slightly harder.

Then regenerate and verify:

```bash
npm install -D wrangler@latest
npm run cf-typegen                         # rewrites worker-configuration.d.ts (committed)
npm run verify
CLOUDFLARE_ENV=production npx vite build
npx wrangler deploy --dry-run -c build/server/wrangler.json   # no account needed; prints size
```

`worker-configuration.d.ts` grows by about 1200 lines: the new runtime types plus ambient `declare module
"*.txt"|"*.html"|"*.sql"|"*.bin"|"*.wasm"` blocks. Commit it as generated.

Reviewed against the `workers-best-practices` and `wrangler` skills and the installed config schema, and
**left unchanged** because already correct: `nodejs_compat`; `secrets.required` declared at top level and in
`env.production`; every binding, var, trigger and observability block re-declared in `env.production`; D1
`migrations_dir`; queue consumers with `max_retries: 8` plus a dead-letter queue per queue (batch size 10 and
timeout 5 s are the defaults; the uninstall-deferral path sets its own retry delays in code); two crons in
production; `ratelimits` fail open; no `placement` (Smart Placement is a latency tuning decision, not a
default; enable it only after measuring D1 round trips); no `passThroughOnException`, no module state (enforced
by lint and tests). Bundle size: Total Upload 5546 KiB / 1270 KiB gzip, well under the 10 MB paid limit
(https://developers.cloudflare.com/workers/platform/limits/). `npx wrangler check startup -c build/server/wrangler.json`
measured about 54 ms active startup locally.

**Risky for an app in PRODUCTION:**

1. **`compatibility_date` is a runtime behaviour change.** Deploy it to staging first and exercise webhooks,
   the queue consumers, the crons and the embedded app. Roll back by restoring the old date and redeploying.
   (Tests also run on the new date, because the Workers test pool reads `wrangler.jsonc`.)
2. `redact_query_string` changes what is stored in logs from the next deploy.
3. The `env.production` block must be edited together with the top level; a missed copy silently leaves
   production on the old setting.
4. Do not touch queue names, DLQ names, cron strings, `secrets.required` or D1 `database_id`/`migrations_dir`
   in the same change: none of this section requires it, and a changed queue name orphans in-flight messages.

### 6. Best-practice changes

| Change | Affected if | What to do |
|---|---|---|
| **tsconfig strictness**: `verbatimModuleSyntax`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch` | Your `tsconfig.json` lacks them | Add the four (`"allowImportingTsExtensions": true` is added too, see the next row). They had **0** violations in this template (measured with `tsc --noEmit --<flag>`). Count yours first; fix `import type` and missing returns if any |
| `allowImportingTsExtensions` | `vitest.config.ts` imports a local file without an extension; Vite 8 prints `Your Vite config uses features that are unsupported by configLoader: 'native'` (planned future default) | `vitest.config.ts`: `from "./app/test/cleanup-schema.ts"` and set `"allowImportingTsExtensions": true` (legal because `noEmit` is on) |
| **Not enabled**, with counts so you can decide: `noUncheckedIndexedAccess` (15 errors: `app/domain/plan-hierarchy.ts`, `app/models/shop-subscriptions.server.ts`, `app/routes/app/billing.tsx`, `app/routes/app/home.tsx`, `app/routes/internal/support/new-form-state.ts`, `app/session-storage.server.ts` and 4 test files) and `exactOptionalPropertyTypes` (69) | You want them | Each fix touches billing/entitlement/session code and needs a real guard (no `!`, no `as`), so they were left for a dedicated change |
| **ESLint**: `tseslint.configs.recommendedTypeChecked` not adopted | You want the typed tier | Measured: 598 findings (454 `require-await`, 62 `no-base-to-string`, 20 `only-throw-error` which is the React Router `throw redirect()` pattern, 18 `no-unnecessary-type-assertion`, 12 `no-unsafe-assignment`, 6 `unbound-method`, the rest under 6 each). Not adopted: mostly async fakes implementing port interfaces. If you want a subset, `no-base-to-string` is the one that catches real `[object Object]` bugs. `eslint-plugin-react-hooks` is already enabled; `jsx-a11y` was not added because Polaris renders custom elements, not the DOM elements it checks |
| **CI** (`.github/workflows/ci.yml`) | Your workflow lacks them | Added `permissions: contents: read`, `concurrency` with `cancel-in-progress`, `timeout-minutes: 20`; actions to v7 (section 1). Caching was already present (`cache: npm`). **The workflow itself could not be run here**; confirm the first run on a branch |
| **Dependabot** (`.github/dependabot.yml`, new) | You have none | Weekly `npm` (minor and patch grouped into one PR; majors separate) and `github-actions`. Its header lists the peer-pinned sets from section 3e |
| **`npm test` runs `scripts/check-placeholders.test.mjs`** | Your `test` script lists node tests explicitly | It guards `npm run cf:deploy` and was run by nothing. Add it to the `node --test ...` list. Two other node tests are still not wired: `scripts/admin-query.test.mjs` and `scripts/seed-admin.test.mjs` pass when run by hand; `scripts/drizzle-only.test.mjs` **fails on the unmodified baseline** (2 of 3 tests: the Drizzle-only SQL scan reports violations) and is a separate defect to triage |
| **`.gitignore`** | You run `wrangler check startup` | Add `*.cpuprofile` |
| **Prettier**: `format:check` NOT added to `verify` | Your downstream app runs `prettier --check` | This repo has no prettier config and `prettier --check .` reports 601 files; adopting it means reformatting the whole repo with defaults (80 columns, against a codebase with long lines), which would conflict with every downstream copy. Keep Prettier as an editor tool, or add a `.prettierrc` that matches the existing style and run a single pure-format commit before adding the check. `.editorconfig` already exists |
| `npm audit` | | `npm audit --omit=dev`: **0 vulnerabilities**. `npm audit` (dev tooling): 28 (24 high, 4 moderate), all through two dev-only chains: `@shopify/cli` -> `global-agent` -> `roarr` -> `sprintf-js`, and `@shopify/api-codegen-preset`/`graphql-config` -> `@graphql-tools/*` -> `globby`/`fast-glob` -> `braces`. `npm audit fix --force` proposes **downgrading** `@shopify/cli` to 3.77.1, which is wrong. Not fixed here; they ship in no runtime |

### 7. Things to watch (not changed)

* **npm 12 and install scripts.** npm 11.19 (bundled with Node 24.21) prints that `esbuild`, `workerd` and
  `@parcel/watcher` install scripts are "not yet covered by `allowScripts`" and its manual says dependency
  install scripts are blocked by default. Install, tests and build all worked here. npm's latest is 12.2.0;
  behaviour there is **unverified**. If a binary is missing after `npm install`, run `npm install-scripts ls`
  then `npm install-scripts approve <pkg>` (it writes an `allowScripts` field into `package.json`).
* Vitest 5's `isolate: false` hint for the `unit` project (not taken, see 3b).

### Final checklist for a downstream app

```bash
nvm install 24 && nvm use                          # >= 24.15
# sections 1 to 3: package.json, .nvmrc, ci.yml, vitest.config.ts, tsconfig.json, README
rm -rf node_modules && npm install && npm run verify
# section 4: version files + codegen, then a separate commit
# section 5: wrangler.jsonc (top level AND env.production), npm run cf-typegen
npm run verify
npx vitest run --sequence.shuffle.files
CLOUDFLARE_ENV=production npx vite build
npm audit --omit=dev
```

Production apps: stage sections 4 and 5 separately (Worker first, then `shopify app deploy`), and do not
combine either with a queue, cron, secret or migration change.

---

## Upgrading @shopify/shopify-app-react-router 2.x -> 3.x

Verified 2026-10-09 against this template: the full suite (196 files, 1602 tests), typecheck, lint,
`vite build` and a dev-server smoke test all pass with **no source change** beyond `package.json`. The
breaking changes in 3.x only touch surfaces this template does not use. Check your app against the
list below before assuming the same.

### 1. Dependencies (the only mandatory change)

`@shopify/shopify-app-react-router` 3.x depends on `@shopify/shopify-api` ^15 and
`@shopify/shopify-app-session-storage` ^7, and declares `react-router ^7.6.2` as a peer. Keep the three
Shopify packages in step.

```diff
-    "@shopify/shopify-api": "^14.0.0",
-    "@shopify/shopify-app-react-router": "^2.0.0",
-    "@shopify/shopify-app-session-storage": "^6.0.0",
+    "@shopify/shopify-api": "^15.0.1",
+    "@shopify/shopify-app-react-router": "^3.0.2",
+    "@shopify/shopify-app-session-storage": "^7.0.1",
```

```bash
npm install @shopify/shopify-app-react-router@^3.0.2 @shopify/shopify-api@^15.0.1 @shopify/shopify-app-session-storage@^7.0.1
```

Nothing else is required: `@shopify/polaris-types` and `react-router` stay as they are (this template
is on `react-router` 7.18.2, which satisfies the peer). `npm install` may re-sort `package.json`
keys; that is harmless.

Both libraries require **Node >= 22** (already true for react-router 2.0.0). `.nvmrc` here is 24.14.0.
If your `package.json` `engines.node` still admits 20.x, it is wrong for these packages.

### 2. What changed in 3.x, and whether your code is affected

Search your app for each pattern with `rg`. If it does not match, there is nothing to do.

| Change (package) | Affects you if | Before -> after |
|---|---|---|
| Events webhooks: `eventId` and `resourceId` removed from `authenticate.webhook(request)` results (react-router 3.0.0, api 15.0.0) | You adopted the Events preview and call `authenticate.webhook` for it. `rg "resourceId\|eventId" app` on code that reads the library's result | `const { eventId, resourceId } = await authenticate.webhook(request)` -> dedupe on `webhookId`, read the resource GID from `payload`. Classic webhooks keep `eventId` (`X-Shopify-Event-Id`). This template reads that header itself in `app/adapters/shopify-webhook.server.ts`, so it is unaffected |
| `authenticate.admin` only follows `exitIframe` redirects to the app origin or the Shopify admin (3.0.1) | You send merchants to an external URL through the library's exit-iframe path (`auth.exitIframePath`) | `redirect(externalUrl)` through exit-iframe -> `redirect(externalUrl, { target: "_top" })`. A refused destination throws `ShopifyError`. The template has no such call |
| Cookies set by `@shopify/shopify-api` are `HttpOnly` by default; boolean cookie attributes serialise as bare flags (api 15.0.1) | Browser JS reads OAuth/session cookies, or you parse `Set-Cookie` expecting `secure=true` | Read them on the server, or pass `httpOnly: false`. This template runs no OAuth callback and has no such code |
| Debug logs mask credentials (api 14.0.1/15.0.1) | Log parsing depends on token values | None |
| New optional `polarisUrl` on `shopifyApp({...})` and `<AppProvider>` (3.0.x) | You want a Polaris release candidate | Leave unset |

Unchanged in 3.x (verified by diffing 2.0.0 against 3.0.2): the `shopifyApp` options we pass
(`apiKey`, `apiSecretKey`, `apiVersion`, `scopes`, `appUrl`, `authPathPrefix`, `sessionStorage`,
`distribution`, `hooks.afterAuth`, `future.expiringOfflineAccessTokens`, `customShopDomains`), the
`authenticate.admin` / `unauthenticated.admin` contracts, token-exchange and offline-token refresh
(`ensure-offline-token-is-not-expired`, `refresh-token`), the `Session` shape, the `SessionStorage`
interface (so `app/session-storage.server.ts` and its tests are untouched), `boundary`,
`addDocumentResponseHeaders`, `login`, the `@shopify/shopify-api/adapters/cf-worker` import, and the
`ApiVersion` enum (`July26`, `October26`, `Unstable`). `AppProvider` still requires `apiKey`.

### 3. API version: not part of this upgrade

`apiVersion = ApiVersion.July26` in `app/shopify.server.ts` and `api_version = "2026-07"` in
`shopify.app.toml` and `shopify.app.dev.toml` are one decision. Version 3.x offers
`ApiVersion.October26` but does not require it. Change all three together, deliberately, in a separate
commit.

### 4. Verify

```bash
npm install
npm run verify                      # typecheck + lint + full suite
npx vite build                      # production bundle
npm audit --omit=dev
```

Then load `/app` inside a development store once, to exercise token exchange and the offline-token
refresh for real. That path is not covered by any automated test in this repo.
