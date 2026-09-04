# Pre-release audit

Comprehensive review of the template against its own rules (`AGENTS.md`, `.claude/rules/*`), Shopify App Store requirements, and production-readiness. `npm run verify` was green at audit time (917/917 tests pass, 109 s). Findings below are conformance defects, not build failures.

Severity scale: **CRITICAL** = exploitable / unbounded cost today; **HIGH** = blocks production or App Store submission; **MEDIUM** = should fix before next app inherits the template; **LOW** = polish.

---

## CRITICAL

### C1. Floating promise in SSR hot path
- **Where:** `app/entry.server.tsx:66`
- **Problem:** `stream.allReady.then(() => clearTimeout(timeout))` is unhandled — every timed-out render produces an unhandled rejection (the `controller.abort()` at line 44 deliberately triggers one). The eslint config does **not** enable `@typescript-eslint/no-floating-promises` despite `.claude/rules/cloudflare.md:132-133` naming it "the gate".
- **Fix:**
  1. In `entry.server.tsx`: `ctx.waitUntil(stream.allReady.finally(() => clearTimeout(timeout)))` — thread `ctx` from the worker through to the entry handler.
  2. In `eslint.config.js`: switch to `tseslint.configs.recommendedTypeChecked` (or add `parserOptions.projectService: true`) and explicitly enable `no-floating-promises` + `no-misused-promises`. Fix the legitimate fallout; do not downgrade to `warn`.

### C2. AI gate is `allowAll` — unbounded Workers AI bill
- **Where:** `app/wiring.server.ts:247-249`, `app/ai/gate.ts:77-81`
- **Problem:** No plan gate, no quota gate, no kill switch. `App Distribution: AppStore` means any free-plan merchant can call Workers AI indefinitely and drain the bill overnight. The gate's own doc-comment (`gate.ts:22-35`) shows the correct pattern; it isn't wired.
- **Fix:** in `wiring.server.ts`:
  ```ts
  export function aiGate(): AiGate {
    return composeGates(
      planGate,           // free plans cannot use AI
      monthlyQuotaGate,   // read ai_runs sum for current month, refuse at N tokens
      killSwitchGate,     // env flag to disable AI during incidents
    );
  }
  ```
  Add unit tests proving a free-plan call is refused, a quota-exhausted call is refused, and the kill switch flips behavior.

---

## HIGH

### H1. Composition root is not the composition root
- **Where:** `app/wiring.server.ts:125` (the banner) vs 31 adapter-construction sites outside it.
- **Hot spots:**
  - `app/notifications/notify.server.ts:95,165` — `new NotificationLogRepo()`, `new NotificationSettingsRepo()` (ring 3 → ring 4, illegal).
  - `app/routes/app/support/new.tsx:95`, `support/detail.tsx:135`, `resources/support-upload.tsx:35` — `new SupportRepo()` in routes.
  - `app/routes/internal/dashboard.tsx:40-43` — four repo constructors in one loader.
- **Fix:** every adapter construction goes through a `wiring.server.ts` accessor. If the file grows, split into `wiring/<surface>.server.ts` re-exported by one facade. Add a lint rule (`no-restricted-syntax` matching `new …Repo()` outside `wiring/**`) so a future contributor cannot reintroduce the leak.

### H2. Documented orphan-blob cron does not exist
- **Where:** `app/routes/resources/support-upload.tsx:20-23` documents a daily sweep; `app/services/scheduled.server.ts:12-24` only sweeps password-reset tokens + partner history.
- **Problem:** `pending_uploads.expiresAt` is written, filtered on read, and deleted only by tenant purge. Every abandoned attachment (up to 100 MB each) is billed forever. This is a No-Cheating violation — a comment asserts behavior that was never implemented.
- **Fix:**
  1. Add `deleteExpiredUploads(cutoff)` returning the R2 keys to `ScheduledDependencies` port (`app/ports/scheduled.ts`).
  2. Implement in `TenantPurgeRepo` (or a new `PendingUploadRepo`) with the actual `env.UPLOADS.delete(keys)` call.
  3. Add a third sweep in `runScheduledSweeps` that returns `{ deletedKeys, deletedRows }`.
  4. Test: seed `pending_uploads` past expiry + a matching R2 object, run the sweep, assert both are gone.
  5. Until implemented, **delete the false comment** in `support-upload.tsx` — the trade for never buffering is unsound without it.

### H3. No login rate-limit, no password-reset rate-limit
- **Where:** `app/routes/internal/login.tsx`, `forgot-password.tsx`; `wrangler.jsonc:88-95` only declares `SUPPORT_LIMITER`.
- **Problem:** PBKDF2-600k ~200 ms means ~5 attempts/sec/CPU. Trivial botnet bypass. Forgot-password has only a per-user throttle (`MAX_ACTIVE_TOKENS=3`), not per-IP — mailbox flood vector.
- **Fix:**
  1. Add two rate-limit bindings in `wrangler.jsonc`:
     ```jsonc
     { "name": "LOGIN_LIMITER",  "namespace_id": "1002", "simple": { "limit": 5,  "period": 60 } },
     { "name": "RESET_LIMITER",  "namespace_id": "1003", "simple": { "limit": 3,  "period": 60 } },
     ```
  2. At the top of `login.tsx` and `forgot-password.tsx` actions, key the limiter by `request.headers.get("CF-Connecting-IP")`. **Fail-closed** for these two — a missing limiter must NOT allow unlimited password guessing. (The documented `SUPPORT_LIMITER` fail-open is right for the merchant-write path, not for auth.)
  3. Test: 6th login attempt from same IP within 60 s returns 429.

### H4. GET logout is a CSRF / prefetch vector
- **Where:** `app/routes/internal/logout.tsx:11-12` — `loader = destroyAdminSession`.
- **Problem:** Link prefetchers, `<a href>` images, browser preloads silently sign the user out.
- **Fix:** delete the `loader`. Make logout POST-only; the nav form already posts.

### H5. Compliance logs plaintext shop; webhook logs hash it
- **Where:** `app/services/compliance.server.ts:89,111,137` log `shop` plaintext. `workers/app.ts:53-54` and `app/services/webhook-logging.ts` correctly SHA-256 the shop before logging.
- **Problem:** Compliance logs are the most legally sensitive logs in the app. They should be hashed like every other shop identifier.
- **Fix:** extract `logShopScopedEvent(name, fields)` (or reuse `formatWebhookLog`) at the three compliance call sites. One-line change per site.

### H6. `SHOPIFY_API_SECRET` doubles as attachment-token HMAC key
- **Where:** `app/wiring.server.ts:162`
- **Problem:** One secret compromise unlocks forged webhook deliveries AND forged attachment URLs. Rotating the secret kills every live attachment URL mid-thread.
- **Fix:**
  1. Add `ATTACHMENT_TOKEN_SECRET` to `secrets.required` in both env blocks of `wrangler.jsonc`.
  2. `wrangler secret put ATTACHMENT_TOKEN_SECRET` for local + prod.
  3. Change `supportService()` to `signAttachment: async (id, exp) => signAttachmentToken({ secret: env.ATTACHMENT_TOKEN_SECRET, ... })`.

### H7. `AI_GATEWAY_ID` missing from production env vars
- **Where:** `wrangler.jsonc:134` declares it at top-level; `:196-207` (production) does not.
- **Problem:** Named-env vars are not inherited (the file's own comment at `:141-144` warns of this). Production AI Gateway caching/cost-tracking/request-logs are silently off. `check-placeholders.mjs` does not catch this — it greps for `REPLACE|CHANGE_ME|TODO`, not for missing keys.
- **Fix:**
  1. Add `"AI_GATEWAY_ID": ""` to `env.production.vars`.
  2. Extend `check-placeholders.mjs` to assert `env.production.vars` is a superset of top-level `vars`.

### H8. Login distinguishes "disabled" vs "invalid credentials"
- **Where:** `app/services/admin-auth.server.ts:122-167`, `app/routes/internal/login.tsx:32-36`
- **Problem:** The dummy-hash equalization on unknown email is undone by the message difference. User-enumeration oracle.
- **Fix:** always return `{ ok: false, reason: "invalidCredentials" }` to the route. Log the disabled case server-side only. Render one error string.

### H9. Logout does not invalidate server-side session
- **Where:** `app/services/admin-auth.server.ts:61-67`
- **Problem:** Only the cookie is cleared. The signed cookie remains valid for 7 days. A user on a borrowed/lost device has no recourse.
- **Fix:** add a server-side session table in KV (key `internal_session:<id>`, value `{ userId, expiresAt }`). On `destroyAdminSession`, delete the row. On every `getAdminUser`, check the row still exists. Reuse the same signed-cookie shape; this is defense-in-depth.

### H10. No deploy workflow
- **Where:** `.github/workflows/ci.yml` only runs `verify` + production build. No `deploy.yml`.
- **Problem:** Production deploys happen on a developer's laptop. Broken production deploys (migrations, custom domain DNS, runtime init) are invisible to CI.
- **Fix:**
  1. Add `.github/workflows/deploy.yml` triggered on push to `main` (after `verify` passes), gated by `environment: production` with required reviewers.
  2. Use OIDC: `cloudflare/wrangler-action@v3` with `CLOPIFY_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` from GitHub OIDC → Cloudflare.
  3. Steps: `npm ci --ignore-scripts` → `npm run cf:deploy` → smoke test (`curl -fsS https://$SHOPIFY_APP_URL/healthz`).
  4. Keep the manual `cf:deploy` as fallback.

### H11. `postinstall` runs non-hermetic network call on every CI install
- **Where:** `package.json:10` → `scripts/setup-agents.mjs` → `scripts/install-skills.mjs`.
- **Problem:** `--locked` mode still shells `npx skills experimental_install` on a fresh checkout (~90 MB, minutes). `vitest.config.ts:36-48` blocks outbound only inside `vitest run`, not `npm ci`.
- **Fix:**
  1. `if (process.env.CI) process.exit(0)` at the top of `setup-agents.mjs` (mirrors `seed-admin.mjs:50-55`).
  2. Use `npm ci --ignore-scripts` in CI workflows.

### H12. No `npm audit`, no Dependabot
- **Where:** `.github/workflows/ci.yml`, no `.github/dependabot.yml`.
- **Problem:** The two overrides in `package.json:106-112` are manual and drift. README's "0 vulnerabilities" ages immediately.
- **Fix:**
  1. Add `npm audit --omit=dev --audit-level=high` step in CI.
  2. Add `.github/dependabot.yml` with weekly npm + github-actions groups.

---

## MEDIUM

### M1. Webhook handler map is `Record<string, …>` with `throw` on unknown
- **Where:** `app/services/webhook-consumer.ts:23, 49-60`
- **Problem:** `design-patterns.md:53-56` forbids both. Adding a topic in `shopify.app.toml` produces no compile error; the consumer throws and burns all 8 retries before DLQ.
- **Fix:** union-keyed map:
  ```ts
  type WebhookTopic = "app/uninstalled" | "app/scopes_update";
  readonly handlers: Record<WebhookTopic, Handler>;
  ```
  Unknown topics: log + return `{ outcome: "unsupported", topic }` instead of throw. The compliance server (`compliance.server.ts:158-187`) is the model.

### M2. `webhook_deliveries` lifecycle has no state machine
- **Where:** `app/models/webhook-deliveries.server.ts:26-131`
- **Problem:** Six-state lifecycle encoded as five implicit SQL `WHERE` clauses. Legal transitions undeclared; illegal transitions silently update zero rows. `PROCESSING_LEASE_MS` (a business decision) lives in an adapter. `app/domain/subscription-lifecycle.ts` is the right pattern — webhook inbox got none.
- **Fix:** `app/domain/webhook-delivery-lifecycle.ts` with a transition map as data + a pure `transition(from, event): Result`. The repo becomes a dumb writer of a decided next state.

### M3. Two `as` casts on untrusted external input
- **Where:** `app/routes/webhooks/compliance.tsx:27`, `app/components/support/AttachmentPicker.tsx:91`
- **Problem:** Shopify webhook body and HTTP response body cast without a Zod parse. Only two `as` casts in production code outside the sanctioned `~/money` branding constructors.
- **Fix:** Zod schemas in `app/schemas/webhooks.ts` and `app/schemas/support.ts`. On failure, log a structured event and return 400/422.

### M4. Unscoped reads/writes on shop-scoped tables
- **Where (sample):**
  - `app/services/support.server.ts:313` `findAttachment(id)`
  - `app/services/support.server.ts:112,261,286` `findForStaff`, `closeAsStaff`, `markReadAsStaff`
  - `app/services/ai.server.ts:147,158` `recentRuns`, `tokensSince`
  - `app/models/notification-logs.server.ts:129,138` `recent`, `deleteOlderThan`
  - `app/models/shop-subscriptions.server.ts:63` `listCurrent()`
  - `app/models/shopify-events.server.ts:78` `listRecentSubscriptionEvents`
  - `app/models/shops.server.ts:144,149` `listAll`, `countInstalled`
- **Problem:** `data.md:14-22` requires `shop` as first parameter. Some are intentional staff-scoped, but the safety lives entirely in the route; a "shop-scoped staff" role added tomorrow becomes an IDOR. **Three model test files have zero cross-tenant assertions; three model files have no test file at all** (`notification-logs.server.ts`, `password-reset-tokens.server.ts`, `admin-users.server.ts`).
- **Fix:**
  1. Rename staff-scoped methods `_forStaff()` or move to a separate `StaffRepos` namespace.
  2. Add a cross-tenant test for every shop-scoped query: insert rows for shops A and B, run the query for shop A, assert no B rows are returned.
  3. Add unit + integration tests for the three untested models.

### M5. Tenant FK cascade absent
- **Where:** every shop-scoped table — `shops` is the PK but no `REFERENCES shops(shop)` declared anywhere.
- **Problem:** Defence is `assertTenantPurgeCoverage` (`tenant-purge.server.ts:105-113`), which is excellent but application-level. A raw SQL admin script bypasses it.
- **Fix:**
  1. Add `shop TEXT NOT NULL REFERENCES shops(shop) ON DELETE CASCADE` to every shop-scoped table.
  2. Keep `shopify_events` cascade-free (it's the audit ledger — GDPR retention is contested there).
  3. Add the FKs in a single migration with `PRAGMA foreign_keys=OFF` + `__new_X` rebuild pattern.

### M6. Module-level mutable state
- **Where:** `app/money/currency.ts:17` (`Map<string, number>` cache); `app/shopify.server.ts:81` (`WeakMap<Env, ShopifyAppInstance>`).
- **Problem:** Both violate the absolute rule. `currency.ts` even has a comment at `:27-32` explaining why a `let` was removed, then re-introduces the same reasoning with a `Map`.
- **Fix:**
  1. `currency.ts`: precompute a frozen `Record<string, number>` over `Intl.supportedValuesOf("currency")` at module load.
  2. `shopify.server.ts`: memoize on `request-context.server.ts` (already has a `db` slot pattern).

### M7. `assertTenantPurgeCoverage` on the hot path
- **Where:** `app/models/tenant-purge.server.ts:95-103` (called from `:50`).
- **Problem:** ~20 sequential `PRAGMA table_info` queries on every GDPR `shop/redact`. Schema-drift check belongs in a test.
- **Fix:** move the assertion to a vitest setup file (run once per test run). Use the `db.batch` result already computed at `:72` instead of discarding it (`void deleted` at `:90` is dead code).

### M8. DLQ has no scheduled drainer; no runbook
- **Where:** `wrangler.jsonc:25-32`; no `docs/OPERATIONS.md`.
- **Fix:**
  1. `docs/OPERATIONS.md` covering: DLQ drain (`wrangler queues consumer <dlq> --batch-size 1` then re-enqueue), rate-limit reset, cron alerting on `event: "cron.sweep_failed"`, `wrangler rollback` recovery, `wrangler d1 backup/restore`.
  2. Optional: a separate consumer for the DLQ that writes a "needs human attention" alert after N hours of accumulation.

### M9. No CSP / HSTS / X-Content-Type-Options / Referrer-Policy on non-embedded routes
- **Where:** only `app/entry.server.tsx:30` calls `addDocumentResponseHeaders`; `/internal/*` and `/public/*` get no security headers.
- **Fix:** `applySecurityHeaders(headers, context)` helper called from `entry.server.tsx`:
  - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.myshopify.com`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-Frame-Options: DENY` for `/internal/*`, `frame-ancestors 'self'` for `/public/*`, no XFO for `/app/*` (embedded admin owns frame policy).
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` on HTTPS.

### M10. Real-looking Partner API token in `.dev.vars`
- **Where:** `.dev.vars:7`
- **Status:** gitignored correctly, not committed.
- **Action:** confirm it is a sandbox/personal token; rotate if production. Even if sandbox, prefer injecting via shell env over file. Add `git log -p -S prtapi .dev.vars` to pre-commit as a paranoia check on history.

### M11. Two commits broke TDD
- **Where:** `5465c07` (5 impl files + migration, zero tests; test arrived in next commit); `fb4eaca` (4 files, zero tests, no follow-up).
- **Action:** none — git history is immutable. Documented so future commits don't repeat. Two mega-commits (`ea4b0ba`, `cfb36ee`) also erase red-green cycles; consider a `rebase -i` before publishing the repo publicly.

### M12. `observability` missing `head_sampling_rate`
- **Where:** `wrangler.jsonc:16, 147`
- **Fix:** add `"head_sampling_rate": 1.0` (or lower if traffic warrants) to both env blocks. Re-evaluate monthly.

### M13. `INTERNAL_SESSION_SECRET` placeholder ships identically across developers
- **Where:** `.dev.vars.example:28`
- **Fix:** replace literal example with `INTERNAL_SESSION_SECRET=<generate with crypto.randomBytes(32).toString('hex')>`; have `setup-agents.mjs` generate one on first run and write it to `.dev.vars` if absent.

### M14. `app/components/support/AttachmentPicker.tsx` fetches
- **Where:** `app/components/support/AttachmentPicker.tsx:70` (`usePendingUploads` does `await fetch(...)`).
- **Problem:** violates "components are presentational" rule.
- **Fix:** move the hook beside the route (`app/routes/resources/support-upload.tsx`'s neighbor) and have the component take `onUpload` as a prop.

### M15. `root.tsx` ships a global stylesheet
- **Where:** `app/root.tsx:33-43` — `<link rel="stylesheet" href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css">` in root.
- **Problem:** the rule explicitly forbids root-level stylesheets to keep public reset out of admin iframe.
- **Fix:** move Inter to `app/routes/app/_layout.tsx`'s `links()`. Public surface keeps system fonts; admin gets Inter.

### M16. `try { … } catch {}` swallowing
- **Where:** `app/routes/resources/ai-draft.tsx:79-82`, `app/services/webhook-queue.ts:68-70`
- **Fix:** add a structured log line on caught errors. `code-craft.md:48` is explicit: a caught error is recorded, logged, and returned as a reason, or re-thrown.

### M17. Compliance `customers/*` handlers return `implemented: true, affected: 0`
- **Where:** `app/services/compliance.server.ts:96-124`
- **Problem:** honest today (no customer PII stored). The moment any customer column is added, these handlers lie to Shopify.
- **Fix:** add a CI test in `app/services/compliance.test.ts` that asserts the current `affected: 0` behavior. Add a CI grep that fails if any new column whose name matches `/(customer|email|phone|name|address)/i` is added to a schema file without an updated handler.

### M18. Billing page may show stale subscription state
- **Where:** `app/routes/app/billing.tsx:88` reads cached D1 projection.
- **Problem:** no subscription-state webhook subscribed. Projection refreshes only on `afterAuth`, hosted-pricing return, `app/uninstalled`, or cron.
- **Fix:** in the loader, if `cachedProjection.observedAt < now - 5 * 60 * 1000`, call `refreshShopSubscription(env, shop)` before rendering.

---

## LOW (polish)

- `app/db/schema/admin-users.ts:24` — drop redundant `admin_users_email_idx` (UNIQUE already indexes).
- `app/db/schema/ai.ts:92` — drop redundant `ai_runs_id_uidx` (PK already unique).
- `app/db/schema/shops.ts:24-26` — add `UNIQUE` on `shopify_shop_id` (still nullable) for cross-system joins.
- `app/db/schema/lifecycle.ts:15-42` — `webhook_deliveries` missing index on `event_id`; consider unique on `(topic, shop, event_id)` if event-level dedupe at receipt is desired.
- `app/db/schema/notifications.ts:66-72` — `notification_logs` over-indexed; profile in prod.
- All enum-typed columns lack `CHECK` constraints — `drizzle-kit` doesn't emit them from `enum:`. Add a follow-up migration with CHECKs.
- `app/db/schema/lifecycle.ts:48-61` — `webhook_scope_observations.shop` is denormalised; comment the trade-off so a future reader doesn't "fix" it.
- `app/components/support/Thread.tsx:133` and `app/components/support/AttachmentPicker.tsx:227` — image alt text repeats filename already in button aria-label; consider `alt=""` for staged previews.
- `app/routes/internal/ai.tsx:368-394` — icon-only `ChainButton`s missing `aria-label`.
- `app/routes/internal/profile.tsx:124-133` — `disabled` email input skipped by SR; use `readOnly` or `<fieldset disabled>`.
- `app/routes/internal/shops/detail.tsx:173-178, 206-211` — empty states are inline `<td colSpan>` rows; use the `EmptyState` component like siblings.
- `app/routes/app/billing.tsx:200-237` — no toast on reconcile-success; mirrors the support pages' `useActionToast`.
- `app/routes/internal/_layout.tsx:99-114` — `NavProgress` is fine but worth a code comment if a `--progress-*` token is ever added.
- `app/components/billing/PlanCard.tsx` + `app/components/support/Thread.tsx` — hand-roll CSS via `dangerouslySetInnerHTML` justified for now; add `// TODO: revisit when Polaris adds font-size/weight control to s-text` with a link to the Shopify issue so the exception has a known expiry.
- `app/routes/public/_layout.tsx:41` — "Install" CTA always points to `/auth/login` regardless of install state.
- `app/internal/use-reply-draft.ts:22`, `app/components/support/CcEmails.tsx:38`, `app/components/support/AttachmentPicker.tsx:44,195` — functions over 60-line cap (rule is "target 40, cap 60"). Refactor after each adjacent change.
- `app/notifications/notify.server.ts:78` — `notify` is 72 lines; split into `notifyByChannel(channel, input)` per channel.
- `.github/workflows/ci.yml` — add `permissions: { contents: read }` at workflow level.
- `wrangler.jsonc:175` — cron `30 3 * * *` prod vs `*/5 * * * *` local: correct, undocumented in README.
- `scripts/install-skills.mjs:350-352` — skill install runs with full agent permissions; document the threat model in the script header.
- `app/routes/public/support.tsx` — does not link to embedded `/app/support/new` for installed merchants.

---

## Shopify App Store launch blockers

These will fail review or be sent back as "needs work" — fix before submission.

| # | Item | Where |
|---|------|-------|
| 1 | All `TODO:` placeholders in `app/legal/content.ts` (`APP_NAME`, `COMPANY_NAME`, `CONTACT_EMAIL`, `COMPANY_ADDRESS`, `LAST_UPDATED`) | `app/legal/content.ts:19-24` |
| 2 | Every privacy + terms body section in `en/public.json` and `es/public.json` is a `TODO` paragraph — must list real subprocessors (Cloudflare, Workers AI, email notifier), concrete retention, identity-verification process | `app/i18n/locales/{en,es}/public.json` |
| 3 | `shopify.app.toml` — `client_id = ""`, `application_url = "https://example.com"`, `scopes = ""`, `auth.redirect_urls = ["https://example.com/auth/callback"]` | `shopify.app.toml:10-13, 33, 44` |
| 4 | `shopify.app.dev.toml` — `client_id = "c0a58386cf12f142409e63d22589b9d9"` checked in. Confirm safe; rotate the secret if exposed | `shopify.app.dev.toml:3` |
| 5 | `billing/plans.ts:48,55` — `name: "TODO:FREE"`, `"TODO:PRO"` are merchant-visible plan names | `app/billing/plans.ts` |
| 6 | `appName` placeholder in `i18n/locales/{en,es}/common.json:2` affects every header/footer/title | `app/i18n/locales/common.json` |
| 7 | Warning banners `legal.{privacy,terms}.warning` visible on live pages; remove from rendered output | `app/routes/public/legal/{privacy,terms}.tsx` |
| 8 | Spanish translation coverage: 100% parity with English enforced by tests; both files need updates in lockstep | `app/i18n/locales/es/*.json` |

---

## Verified good (do not break)

- **Money:** integer-only via `~/money`; D1 columns use `money()`/`nullableMoney()`; zero `parseFloat`/`real()`/`toFixed` in any schema; 1500-input `allocate` property test.
- **i18n:** two locales with structural-parity tests (key-set equality, no empty strings, identical `{{interpolation}}`); SSR hydration shares locale; `useLocale()` decoupled from route-id.
- **Sessions:** KV-only; offline-session TTL correctly omitted (`expiringOfflineAccessTokens` would kill refresh tokens); metadata cap handled with fallback.
- **OAuth install recording:** `afterAuth` correctly hooked; the v2 token-exchange "shops row never created" bug is fixed.
- **Webhook HMAC:** library-level, timing-safe, fires before any side effect; raw body preserved by Workers reality; compliance returns 401 on bad HMAC; idempotency via `INSERT … ON CONFLICT DO NOTHING` on `X-Shopify-Webhook-Id`.
- **Tenant purge:** `assertTenantPurgeCoverage` is a first-class runtime invariant.
- **Password reset:** 256-bit tokens, hashed, single-use, per-user-throttled, sibling-invalidating.
- **Internal cookie:** HttpOnly + Secure(https) + SameSite=Lax + fail-loud on missing secret + PBKDF2-600k + opportunistic upgrade.
- **Polaris admin:** real `<s-page>`/`<s-section>`/`<s-stack>`/`<s-grid>`; `AppProvider` + `NavMenu` from app-bridge-react; Save bar appears once per screen; `breadcrumb-actions` for back nav; templates used (Details, Index, Settings, Homepage).
- **Public SCSS:** three-layer dark mode in tokens; `m.focus-ring` everywhere; reduced-motion zeroed; semantic HTML; skip link first.
- **Internal console:** ngk-dashboard + Tailwind v4 with explicit `@source` globs; English-only by design and documented.
- **Stylesheet scoping:** three stylesheets, three sets of routes — no bleed.
- **Tests:** 917/917; zero `.skip`/`.todo`/`.only`; outbound network blocked at vitest pool.

---

## Suggested fix order

1. **C1** + enable type-aware lint (4-6 h including fallout)
2. **C2** AI gate composition (1-2 h, prevents 5-figure bill)
3. **H2** implement orphan upload sweep or delete the false comment (1 h)
4. **H3 + H7 + H8 + H9** auth/rate-limit/headers/session-invalidation (~½ day)
5. **H10 + H11 + H12** CI: deploy.yml, hermetic postinstall, npm audit + Dependabot (½ day)
6. **H5 + H6** compliance log hash reuse + separate file-token secret (30 min)
7. **H1** route all adapter constructions through `wiring.server.ts` (½-1 day)
8. **M1 + M2** webhook union type + delivery state machine (½ day)
9. **M5 + M9** FK cascade on shop-scoped tables + global security-headers helper (½ day each)
10. **M4** cross-tenant tests for every shop-scoped query, plus the three untested models (1 day)
11. **App Store launch blockers** — content only, but required for submission
