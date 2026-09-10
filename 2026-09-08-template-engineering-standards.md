# Template Engineering Standards And Rollout Plan
> For implementers: use the executing-plans skill to deliver one task at a
> time. This document authorizes documentation, not automatic implementation
> or deletion of existing tests. All implementation checkboxes are pending.
**Goal:** Make new apps easier to configure without duplicating identity,
misusing Shopify identifiers, bypassing typed database access, or maintaining
tests that do not protect behavior.
**Architecture:** Keep one owner for product identity, preserve Shopify's
identifier contracts, and use the existing Drizzle model adapters. Keep
decisions inside the functional core and use cases, with adapters wired through
`app/wiring.server.ts`.
**Tech stack:** TypeScript, React Router, i18next, Shopify App Pricing,
Shopify Admin/Partner GraphQL, Cloudflare D1, Drizzle, Vitest.
**Input:** `docs/MY_FOUND_DO_NOT_COMMIT.md` and the user's subsequent discussion.
The original note remains untouched.

## Status And Authority

### Reliability gate: supported contracts, not workarounds
The objective is reliable, environment-correct identity, not eliminating the word
`handle`. Use stable IDs where Shopify documents ID inputs; retain a dynamically
obtained handle where Shopify documents a handle input. Never substitute an ID
into a URL because it appears to work in one browser or development store.
Before implementation is accepted:
- [ ] Record the official source and API version for every changed Shopify input.
- [ ] Preserve the official authentication flow and SDK navigation mechanisms.
  Do not scrape admin pages, parse undocumented dashboard URLs, intercept private
  endpoints, invent ID conversions, or introduce a second authentication system.
- [ ] Treat local configuration consistency checks as our safeguards, not a
  Shopify-mandated API feature. Avoid extra identity round trips on every request;
  verify at an authenticated setup/reconciliation boundary and deployment checks.
- [ ] Distinguish schema validation, local integration tests, and live dev-store
  verification. None replaces the other; record blocked checks as incomplete.
- [ ] Never approve ID values merely because a permissive GraphQL `ID` scalar
  typechecks, or treat an empty subscription response as evidence of identity.
- [ ] Preserve tenant isolation, existing security gates, and error reporting.
  Never manufacture missing identity or silently change billing entitlement.
- [ ] Keep custom architecture/Drizzle/i18n choices labeled as repository choices;
  do not claim Shopify recommends a particular internal constants-file design.
- [ ] Stop a proposed change when no documented equivalent exists. Keep the
  supported integration instead of implementing an undocumented shortcut.
This is a proposed standards and rollout document, not a completed migration.
`AGENTS.md` remains the repository's single source of truth. Amend its linked
rules before adopting any proposal here that changes their wording. This
document does not grant exceptions to TDD, tenant isolation, or verification.
The code observations below were made during the September 8 review. Other work
is changing the repository; re-read affected files before implementation. The
research did not execute a live merchant billing flow or comprehensively audit
every test. Do not interpret the observations as a clean bill of health.

## Decisions At A Glance

| Item | Decision | Work needed |
| --- | --- | --- |
| 1. Identity | One small identity file, reused by current consumers | Remove duplicated identity values; preserve translations |
| 2. Shopify identifiers | Use the identifier required by each Shopify contract | Audit actual hardcoding; retain dynamic pricing handle lookup |
| 3. Database access | Drizzle query builder first, narrow reviewed SQL exceptions | Inventory and migrate ordinary direct-D1 queries |
| 4. Tests | Test observable behavior, contracts, and meaningful failure modes | Strengthen weak assertions without reducing protection |

## Global Constraints

- No production behavior change without a failing test observed first.
- Refactoring existing correct behavior stays covered by existing green tests;
  do not invent a missing feature merely to obtain a red test.
- New regression or acceptance cases must demonstrate that they detect the
  intended defect. Document the observed failure and subsequent green result.
- Never delete, skip, or weaken a test or gate to obtain a passing run.
- Real external services remain blocked in automated tests. Use local bindings
  for D1/KV/R2 and fake external HTTP responses at the outer boundary.
- Use fake ports for isolated use-case decisions as the testing layer table
  prescribes; do not substitute mocked persistence for model integration tests.
- Preserve inward dependencies, shop scoping, integer money with currency,
  existing route structure, and translated merchant/public copy.
- No new ORM, configuration framework, cache, feature flags, or speculative
  metadata. Reuse existing systems.
- No schema change is expected from a query-only refactor. If one is necessary,
  explain why separately and generate a new forward-only migration.
- Never amend applied migrations, stage unrelated work, or commit the original
  `DO_NOT_COMMIT` research note.

## 1. Product Identity

### Observed problems

- `app/legal/content.ts` defines app name, legal company, and privacy contact.
- `app/i18n/locales/en/common.json` and the Spanish counterpart independently
  define the app name.
- `app/emails/layout.tsx` contains another literal app-name fallback.
- `app/routes/public/support.tsx` imports `CONTACT_EMAIL` from legal content.
  Support and privacy currently share a value without explicit role naming.
- `app/urls.ts`, `app/i18n/config.ts`, and billing/entitlement registries already
  own URLs, locale configuration, and feature policy. Do not duplicate them.

### Proposed rules
Use `app/identity.ts` as the single authoring location for stable identity.
It must be pure, client-safe, immutable in use, and free of runtime environment
reads. Do not create a config directory containing many one-field modules.

| Field | Responsibility |
| --- | --- |
| App name | Canonical merchant-facing product name |
| Brand name | Public brand, only distinct if the business uses one |
| Company name | Registered entity used by the legal pages |
| Tagline | Localized short product description, not a second landing-copy system |
| Support email | Monitored merchant support contact |
| Privacy email | Explicit privacy contact; share the support value if genuinely the same inbox |
| Legal address | Existing `COMPANY_ADDRESS`, used in the privacy page; structured identity, not policy prose |
| Policy effective date | Existing `LAST_UPDATED`, shared by privacy and terms; explicit ISO date, never today's date |
| Localized email sender disclosure | Replace the shared layout's placeholder footer with truthful sender identity; preserve message-specific explanations |

### Additional constants identified by inspecting consumers
The goal is not merely to move the original five requested fields. Use the
following inventory to make cloning an app a deliberate setup process:

| Existing value / consumer | Decision and reason |
| --- | --- |
| `COMPANY_ADDRESS` in `app/legal/content.ts` | Move to `identity.legal.address`; a real new-app setup value already consumed by privacy |
| `LAST_UPDATED` in `app/legal/content.ts` | Move to `identity.legal.effectiveDate`; retain the current shared policy-date semantics and existing locale formatter |
| Shared `EmailLayout.footer` placeholder | Supply localized sender disclosure from identity; do not replace the distinct support/password-reset message footers |
| `public/favicon.ico` | Treat the asset file itself as the single owner; add it to the adoption checklist, not a redundant constant for a fixed path |
| Optional `logoUrl` in notification payloads/layout | Keep the existing per-message override; add one optional shared local logo asset path only when an actual default asset is supplied |
| `landing.lead` used for the meta description | Already reused correctly; retain its translation key instead of introducing a second SEO-description constant |
| Footer copyright year | Compute/format at render time; never require annual editing of a year constant |
| Footer copyright owner | Keep current app-name behavior unless the owner requires the legal entity; derive from existing identity rather than duplicate a third name |
| Support hours/response target placeholders | Keep localized truthful support copy; introduce structured hours only if a real scheduling/availability consumer exists |
| Product features/prices/limits | Existing billing and entitlement registries own these; link them from the adoption checklist rather than copy into identity |
| Colors/typography/email palette | Existing SCSS and email tokens own these; branding adoption includes reviewing those files, not adding a second token system |
Proposed grouping inside the ONE file: `name`, `brandName`, `companyName`,
`contacts`, `legal`, and locale-keyed `copy`. Keep optional brand assets in that
file only if implemented consumers use them. Do not scaffold unused fields.
For a shared logo, store a local path rather than a production/tunnel hostname.
Email composition can resolve the path with the existing `absolute(origin, path)`
URL helper and trusted origin input. Preserve the text brand when no logo exists.
Do not add a guessed logo or new asset-generation work to this migration.
This extends the earlier plan: address and policy date now join the identity file
because they are existing clone-time setup values. Legal policy prose stays in
the current translated/content system, not inside the identity object.
Do not force a new brand name where the app name already serves that purpose.
Do not invent company or contact information; retain identifiable placeholders
until the owner supplies real values and keep production launch checks blocking.
To satisfy both one-file identity and localization, author tagline translations
in a locale-keyed identity value and merge them into the existing i18n resources.
Keep the visible app-name translation entry backed by the canonical identity
value rather than a second independently edited literal. Preserve typed keys in
`app/i18n/i18next.d.ts`/`app/i18n/resources.ts` when adjusting resource composition.
Do not replace translated sentences with concatenated English constants.
Ordinary marketing headings, legal prose, support instructions, labels, and
email sentences remain in their existing translation/content owners. A tagline
is not automatically identical to the landing heading; only merge them when
they actually express the same product copy.
Keep these values OUT of the identity file:

- Route paths and support/documentation URLs: `app/urls.ts` already owns paths.
- Default/supported locales: `app/i18n/config.ts` already owns them.
- Features, entitlements, plans, and prices: existing registries own them.
- Shopify IDs, app handles, credentials, domains, and environment bindings.
- `EMAIL_FROM`: an authorized sending address, not the merchant support inbox.
`EMAIL_FROM_NAME` remains an operational override during this rollout. It is not
another source for UI identity. Do not silently change sender configuration or
make a support address the sender. A later deliberate default-to-app-name change
would require its own email adapter tests.
Shopify TOML and the App Store listing remain platform configuration surfaces;
they cannot import a TypeScript module. Keep recognizable branding consistent,
but do not demand byte-identical development and production names. A development
suffix is legitimate. A single in-app identity file does not automatically
synchronize the external App Store listing.

### Task 1: Consolidate identity without losing i18n
**Files:**
- Create: `app/identity.ts`.
- Modify: `app/i18n/resources.ts`, `app/i18n/i18next.d.ts` if required,
  `app/i18n/locales/en/common.json`, `app/i18n/locales/es/common.json`.
- Modify: `app/legal/content.ts`, `app/emails/layout.tsx`,
  `app/routes/public/support.tsx`, `app/routes/public/legal/privacy.tsx`,
  `app/routes/public/legal/terms.tsx`.
- Test: `app/i18n/render.test.tsx`,
  `app/emails/templates/admin-password-reset.test.ts`,
  new `app/routes/public/support.render.test.tsx`.
- Modify/test: `scripts/check-placeholders.mjs`,
  `scripts/check-placeholders.test.mjs`.
- Documentation: `docs/ADOPTING_THE_TEMPLATE.md`, `.claude/rules/i18n.md`.
**Consumes:** Current locale resources, legal contacts, and email layout props.
**Produces:** One identity definition consumed by resources and presentation;
no new request service, secret, route, or external dependency.

- [ ] Record all current identity consumers and baseline related tests.
- [ ] Write a failing acceptance case proving support uses the support contact,
  not a different privacy contact; assert visible contact output.
- [ ] Write a failing resource/render case proving English and Spanish receive
  their configured tagline and the same canonical app name.
- [ ] Observe each failure before adding its implementation.
- [ ] Add the identity definition and compose resources without mutating shared
  module objects during requests or changing locale detection.
- [ ] Replace the email fallback and migrate legal/support consumers. Preserve
  any intentionally supported explicit email-layout brand override.
- [ ] Move address and policy date into the same identity file; update both legal
  page consumers and placeholder checks. Keep ISO-date validation and localized
  display. Do not change legal statements or silently refresh the effective date.
- [ ] Add a failing merchant-email case for the correct localized sender
  disclosure instead of the layout placeholder; preserve its message-specific
  footer and the staff-facing English-only policy.
- [ ] Review favicon, optional logo, landing description, copyright, support copy,
  and design tokens against the inventory. Record reuse/asset replacement tasks
  in adoption docs; do not create constants with no live consumer.
- [ ] Remove superseded literals rather than maintaining compatibility copies.
- [ ] Update placeholder validation to inspect the new identity source. Its
  current legal-source checks must not silently miss a placeholder after moving
  the constants. Test rejection of missing/placeholder contacts and names.
- [ ] Verify both locales, rendered email branding, public support contact,
  legal company/contact, and translated document titles.
- [ ] Run `npm run verify` and `node --test scripts/check-placeholders.test.mjs`.
**Acceptance:** Editing identity once changes all relevant consumers; neither
Shopify IDs nor existing feature/URL settings have moved into this file.

## 2. Shopify Identifiers And Environment Selection

### Verified facts

- `client_id` is the public app identifier; the credential documentation calls
  the client ID permanent and maps `SHOPIFY_API_KEY` to it. [S1, S2]
- The optional TOML `handle` is the App Home URL slug. Shopify warns that changing
  it changes admin links. It is not a value developers can never control. [S1]
- The published App Pricing URL specifies an app handle, not a client ID:
  `https://admin.shopify.com/store/:store_handle/charges/:app_handle/pricing_plans`.
  No verified source in this research establishes client ID as an interchangeable
  replacement for this URL segment. [S3]
- Admin GraphQL `App.handle` is nullable. The existing handle query was validated
  by the Shopify Toolkit against the `2026-07` schema, but schema validation does
  not prove a live billing flow works. [S4]
- Multiple app configurations are supported. Shopify also documents a shared
  development app with a separate dev store per teammate; separate apps per
  developer are an option, not a universal requirement. [S5, S6]

### Rules

| Value | Use | Owner/source |
| --- | --- | --- |
| Client ID / API key | App authentication and App Bridge | Selected Shopify configuration and Worker environment |
| App Pricing app GID | `activeSubscription.appId` and history `subjectId`: `gid://shopify/App/...` | Copy the current app's Admin `app.id`, configure per deployment |
| Legacy Partner app GID | Older Partner `app(id:)`: `gid://partners/App/...` | Only obtain/configure when that separate operation is used |
| Admin app ID | Admin GraphQL resource identity where requested | Admin API |
| App handle | URLs whose documented shape requires it | Authenticated current-app lookup |
| Plan handle | Map a Shopify subscription plan to the plan registry | Shopify billing data and reviewed plan configuration |
| Shop domain / store handle | Merchant-scoped requests and URLs | Authenticated shop context |
| React Router `handle` | Route metadata, including i18n namespaces | Route module; unrelated to Shopify identifiers |
Never replace these globally based on the word `handle` or `id`. In particular,
the client ID is not automatically a Partner GID or an Admin resource GID. Every
configured app ID must be checked against its expected operation/environment. On a
mismatch, fail closed with a clear operational error; never guess, fall back, or
turn the merchant into a free subscription.
Keep plan handles separate from the app handle in naming and documentation.
Business features must continue using entitlement keys rather than comparing
Shopify plan handles directly.

### Concrete setup: get the correct IDs, then wire them once
**A. Obtain the client ID for each environment.** Open Shopify Dev Dashboard,
select **Apps > the intended app > Settings > Credentials**, and copy its client
ID. This is the value named `client_id` in Shopify TOML and `SHOPIFY_API_KEY` in
this app, not a GraphQL GID. Keep the corresponding secret server-only. [S2]
Link the existing project configurations with the existing npm scripts:

```sh
# Run separately, selecting the intended Shopify app in each prompt.
npm run config:link:dev
npm run config:link:prod
```
These scripts run `shopify app config link`; linking changes local configuration.
Review the resulting TOML diff. Do not run them during this documentation update.
For a developer-specific app, use a separate named local config rather than
relinking the shared file. Shopify documents named configs and `--config`. [S5]
**B. Obtain the app resource GID from the authenticated app itself.** Install/run
that environment's app on a development store and use its authenticated Admin
GraphQL client (`admin` from `createShopify(getEnv()).authenticate.admin(request)`)
to run the following read-only operation. Use the app's context, not an unrelated
GraphiQL app's token: `currentAppInstallation` identifies the caller. [S4, S13]

```graphql
query CurrentAppIdentity {
  currentAppInstallation {
    app {
      id
      apiKey
      handle
    }
  }
}
```
This query was Toolkit-validated against Admin `2026-07` during this update.
Do not add a public debug endpoint to obtain these values. Use an authenticated
development diagnostic or the existing server-side lookup, and remove temporary
diagnostics afterward. IDs are public, but tokens/secrets must never be logged.
Take `app.id` verbatim (the Shopify App GID); compare `app.apiKey` to that
environment's `SHOPIFY_API_KEY` to prove the lookup used the intended app.
Do not take `currentAppInstallation.id`: it identifies the installation, not the
app. Do not construct an app GID from a client ID or infer it from branding. Use
Admin `app.id` only where its namespace matches the exact consuming API.
**C. Configure the GID required by the operations this repository actually uses.**
Official Partner `activeSubscription` and `historicalEvents` examples specify
`gid://shopify/App/1234`. The older Partner `app(id:)` operation instead documents
`gid://partners/App/1234`. The API hostname alone does not select the namespace.
Do not globally rewrite prefixes or assume all Partner operations accept the
same ID. [S14, S15, S16]
Keep the existing variable name `SHOPIFY_PARTNER_APP_ID` to avoid unnecessary
configuration churn, but document that in THIS repository its value is the
`gid://shopify/App/...` returned in step B. Set it independently for development
and `env.production.vars` in `wrangler.jsonc`; local developer values can live in
their ignored `.dev.vars`. Never copy the production app GID into a developer's
different app configuration.
The launch-check fixture currently uses `gid://partners/App/1`; that is not the
documented namespace for the App Pricing/history operations wired here. Correct
the fixture and add rejection coverage as an actual follow-up, not a cosmetic
rename. Blank deployment values prevent concluding that a live app is currently
misconfigured; this is a concrete fixture/validation gap, not a verified outage.
**D. Obtain Partner access separately.** Create a Partner API client for the
owning organization in Partner Dashboard under **Settings > Partner API clients**,
grant **Manage apps** for Active Subscription access, and keep its token in
`SHOPIFY_PARTNER_API_TOKEN`. Configure the owning organization ID in
`SHOPIFY_PARTNER_ORGANIZATION_ID` from the Partner account/API setup, not the app
ID or a merchant ID. Retain the adapter's existing versioned endpoint and
authentication. An Admin merchant token and a client secret are not Partner
access tokens. [S14, S17]
**E. Verify API usage, not merely the string shape.** After comparing step B's
API key/GID pair to configuration, test access with the Partner API client:

```graphql
query VerifyAppPricingIdentity($appId: ID!, $shopId: ID!) {
  activeSubscription(appId: $appId, shopId: $shopId) {
    __typename
  }
}
```
Supply the obtained Shopify App GID and the actual Shopify Shop GID as variables.
This operation was Toolkit-validated for Partner `2026-07`. Schema validation
does not test credentials, access, or identifier values. `null` can mean no active
contract; it alone does not prove an app-ID match. Confirm identity in step B and
verify a known test subscription when exercising the complete billing flow.
Never turn a failed or unauthorized lookup into a free-plan result. [S14]

### How IDs reach the running application

| Run mode | Client ID | App Pricing GID |
| --- | --- | --- |
| `npm run dev` | CLI selects dev app; `vite.config.ts` forwards injected `SHOPIFY_API_KEY` into Worker vars | Explicit local `SHOPIFY_PARTNER_APP_ID` for that same app |
| `npm run dev:local` | Set local Worker configuration; there is no Shopify CLI injection | Explicit local GID for that same app |
| Production | Production TOML/client ID aligned with production Worker vars; secret stored separately | Set `env.production.vars.SHOPIFY_PARTNER_APP_ID` from that production app's lookup |
| Queue/cron | Worker environment, not browser query parameters | Same configured GID; jobs cannot depend on an interactive merchant request |
Do not assume the CLI injects `SHOPIFY_PARTNER_APP_ID`; this project's Vite bridge
only forwards API key/secret, scopes, and app URL. An app switch must update/check
the configured GID as well. Add an authenticated app-identity consistency check
at the Shopify adapter/wiring boundary, with a controlled mismatch failure;
never modify module globals with a fetched identity or trust browser-supplied IDs.

### Why the plan still retains one app-handle use
The agreed approach is **keep the current dynamic handle lookup; do not add an
app-handle environment variable or replace it with an ID**. Shopify's guide uses
`/charges/:app_handle/pricing_plans` and directs developers to use the TOML handle.
Our authenticated lookup is a repository choice using the public Admin API, not
a Shopify requirement to avoid environment variables. It satisfies the documented
URL contract without duplicating a handle across environments. [S3, S4, S18]
Therefore, "do not hardcode handles" is correct; "never use a handle anywhere"
is not supported by the current official integration instructions. Do not place
a client ID/GID into that URL and assume it is equivalent. Keep the handle at the
Shopify navigation boundary, outside identity constants, domain models, and
entitlement decisions. Retain top-level navigation out of the embedded iframe.
If Shopify publishes an ID-based replacement later, validate and test that exact
contract before migrating.
Plan handles returned by App Pricing are a separate documented value. Preserve
their mapping at the billing adapter/catalog boundary; removing them would not
make app identity more stable.

### Current assessment and correction
`app/routes/app/billing.tsx` fetches the app handle dynamically, parses it through
`app/schemas/current-app-installation.ts`, and passes it to
`app/billing/pricing-plans-url.ts`. This is not hardcoded identity. Preserve it
unless Shopify documents a better supported alternative. In both development and
production, this handle comes from the authenticated API response, not an env var.
The project's Vite bridge does not inject it; no `SHOPIFY_APP_HANDLE` is needed.
The schema rejects missing/null/blank handles with a controlled response. Do not
fabricate a handle from the brand or silently fall back to a different app ID.
`vite.config.ts` forwards Shopify CLI development credentials/URL into Worker
vars, while production uses its configured bindings/secrets. Audit environment
alignment instead of introducing a second configuration provider.
One actual departure from Shopify's safety recommendation: this repository uses
`shopify.app.toml` for production. Shopify recommends the default configuration
be development. This is a workflow decision to discuss, not an automatic rename;
the existing scripts intentionally select dev/prod configurations. [S6]

### Task 2: Audit identifiers and change only confirmed defects
**Files to inspect:** `app/routes/app/billing.tsx`,
`app/billing/pricing-plans-url.ts`, `app/schemas/current-app-installation.ts`,
`app/shopify.server.ts`, `app/adapters/shopify-partner.server.ts`,
`app/wiring.server.ts`, `vite.config.ts`, `shopify.app.toml`,
`shopify.app.dev.toml`, `wrangler.jsonc`, `package.json`,
`scripts/check-placeholders.mjs`.
**Tests:** `app/billing/pricing-plans-url.test.ts`,
`app/routes/app/billing.render.test.tsx`, relevant Partner adapter tests, and
`scripts/check-placeholders.test.mjs`.
**Produces:** A categorized inventory and only justified identifier/config fixes.

- [ ] Search runtime, configuration, scripts, tests, and docs. Classify each
  identifier occurrence using the table; distinguish fixtures from production.
- [ ] Run the matching Shopify Toolkit skill and recheck the current contract
  before changing any GraphQL operation, configuration, or billing navigation.
- [ ] For each actual hardcoded environment value, add a failing test using two
  different app/store contexts, then wire the correct source through.
- [ ] Retain tests for missing/null/blank handle payloads, and ensure they prove
  failure rather than a plausible wrong billing URL.
- [ ] Preserve dynamic pricing navigation for two different app handles returned
  by fake external HTTP responses; do not introduce env-based handle configuration.
- [ ] Verify production client ID alignment with TOML and Worker configuration;
  keep Partner app configuration explicitly associated with the same app.
- [ ] Record whether the team uses a shared dev app or developer-local configs.
  If local configs are used, avoid overwriting the shared dev file on each link.
- [ ] Add failing launch-contract cases accepting `gid://shopify/App/...` for
  this variable and rejecting a client ID, installation ID, or legacy Partner
  namespace. Replace the misleading `gid://partners/App/1` positive fixture.
- [ ] Add fake-HTTP adapter cases for matching identity, different `apiKey`,
  different GID, GraphQL errors, and null handle. A configured app mismatch must
  fail clearly without querying billing for another app or overwriting config.
- [ ] Document steps A-E in adoption docs and `.dev.vars.example`. Preserve CLI
  injection of credentials and explicitly explain the separately configured GID.
- [ ] Ask the owner whether to change the default TOML to development. If approved,
  make that a separate script/config/documentation task with matching tests.
- [ ] Validate modified GraphQL with the Toolkit and modified app configuration
  using the Shopify CLI skill. Documentation lookup alone is not config validation.
- [ ] If billing navigation changes, manually verify plan selection and return
  reconciliation on a development store; report access blockers honestly.
**Acceptance:** No unexplained environment-specific literal remains in audited
runtime paths; the dynamic pricing URL contract is preserved. Unchanged correct
code needs no ceremonial rewrite.

## 3. Drizzle-First Database Access

### Facts and risk assessment
The project already uses Drizzle; do not select or install another ORM.
`app/db/client.ts` owns client construction. Runtime application queries belong
in `app/models/*.server.ts`, not routes or use cases.
Drizzle supports D1 batch operations and parameterized SQL fragments. Its
`sql<T>` annotation does not independently validate arbitrary SQL or convert
runtime values to T. Wrapping a raw query in a generic is not proof of safety. [S7]
Cloudflare documents sequential transactional batches with rollback on statement
failure. A successful statement affecting zero rows is not a SQL error; preserve
the application's conditional-update checks as well as the transaction. [S8]
The main direct-D1 concentration observed was
`app/models/entitlements.server.ts`. Other categories include SQL fragments in
model queries, a conditional subscription-item insert in
`app/models/shopify-events.server.ts`, schema introspection in
`app/models/tenant-purge.server.ts`, and database setup SQL in `app/test/db.ts`.
This list is a starting point, not an exhaustive completed migration inventory.
A search for `.prepare()` alone produces false positives:
`app/services/tenant-purge.server.ts` calls a port method named `prepare(shop)`;
that is not a raw D1 query.

### Proposed rules

1. Use schema-backed Drizzle builders for ordinary reads, writes, joins,
   predicates, aggregation, and conflict handling where supported.
2. Use existing operators such as `eq`, `and`, `inArray`, and aggregate helpers
   rather than spelling routine comparisons and table/column names in strings.
3. Keep exceptional SQL inside the database adapter. No runtime raw queries in
   routes, use cases, domain code, or UI.
4. Small parameterized SQL expressions are allowed when necessary for database
   arithmetic or SQLite semantics. They are not a blanket approval for complete
   raw CRUD statements that the builder can express.
5. Direct D1 statements or `sql.raw()` require a recorded reason explaining the
   specific unsupported operation, trust boundary, and integration coverage.
   Complexity alone is not a Drizzle limitation.
6. SQL schema introspection, generated migrations, and test-only trigger/setup
   SQL are distinct categories; do not remove independent schema-coverage checks
   merely to eliminate SQL syntax from the repository.
7. Bind data values. Never interpolate untrusted values into raw SQL. Dynamic
   identifiers require a controlled source and correct identifier escaping;
   placeholders for values do not parameterize table names.
8. Keep all tenant reads/writes scoped to the shop. Do not apply tenant scoping
   mechanically to global staff records or schema metadata.
9. Preserve batch ordering, atomicity, affected-row handling, retry semantics,
   and return values. Never replace an atomic guarded write with a separate
   read/check/write sequence in JavaScript.

### Exception record
For every retained exception, record in the adapter or inventory:

- File and function.
- Why a schema-backed builder is insufficient in the installed Drizzle version.
- How values are bound and identifiers are selected/escaped.
- The batch/SQLite behavior that must not change.
- Exact tests proving isolation, failure behavior, and concurrency where relevant.
Do not claim an operation cannot be expressed by Drizzle without checking the
installed version and official docs. Do not claim a rewrite is equivalent until
the existing behavior and failure tests execute successfully on local D1.

### Task 3A: Inventory and migrate ordinary queries
**Files:** `.claude/rules/data.md`, `app/models/entitlements.server.ts`, other
model files found by the inventory, and their adjacent tests.
**Consumes:** Existing Drizzle schema, model interfaces, and integration tests.
**Produces:** Schema-backed queries with unchanged public repository contracts.

- [ ] Inventory `.prepare(`, `.exec(`, `sql.raw(`, SQL templates, `db.run`/`all`,
  and raw D1 access. Inspect each hit rather than banning tokens blindly.
- [ ] Classify each hit: ordinary CRUD, expression, guarded write, introspection,
  generated migration, test setup, or non-SQL false positive.
- [ ] Update the linked data rule with the approved builder-first policy and
  exception process; keep `AGENTS.md` as the authority rather than duplicating it.
- [ ] Run current model tests as a baseline. Add any missing isolation and
  expected-result cases before changing queries.
- [ ] Migrate simple entitlement counts, reads, and ordinary state updates first.
  Preserve missing-row semantics and numeric conversions.
- [ ] Replace routine SQL predicates and aggregate expressions with supported
  Drizzle helpers where equivalence is straightforward.
- [ ] Run related model tests after each small change, then `npm run verify`.
- [ ] Record every remaining exception and do not present partial conversion as
  complete removal of direct SQL.

### Task 3B: Preserve atomic entitlement and event writes
**Files:** `app/models/entitlements.server.ts`,
`app/models/entitlements.test.ts`, `app/models/shopify-events.server.ts`,
`app/models/shopify-events.test.ts` and related model tests discovered on reread.
Schema or migration changes are not assumed or preapproved.
**Produces:** Equivalent guarded D1 writes, or an explicit documented reason to
retain a narrow SQL exception. Keep the existing port contracts.
Required behavior cases:

| Scenario | Required result |
| --- | --- |
| Two allocations at capacity one | Exactly one new allocation admitted |
| Concurrent reservations near quota | Total committed plus held does not exceed maximum |
| Same operation replayed | No additional reservation or usage increment |
| Reused operation ID with changed input | Conflict, not a second accepted operation |
| Stale subscription revision | Write rejected without changing usage |
| Concurrent commits/releases | At most one effective counter transition |
| Missing or incompatible operation state | Controlled result, no negative counter |
| Same IDs in two shops | No cross-shop read or write |
| Failure partway through batch | No partially applied transactional state |
| Older subscription event arriving late | Does not overwrite newer projection/items |

- [ ] Read current batches, `changes()` guards, conflict clauses, and return
  metadata handling. Write down the invariant before translating the query.
- [ ] Run existing concurrency/replay tests. For missing cases, add regression
  tests and verify they detect the specific incorrect behavior.
- [ ] Use real local D1, multiple competing operations, and assertions on both
  repository results and final persisted counters/rows.
- [ ] Translate guarded inserts/updates using the installed Drizzle builder and
  `db.batch` only where equivalent. Retain a minimal parameterized expression
  when SQLite-specific semantics require it.
- [ ] Never split the guard from the write across separate awaited calls.
- [ ] Verify affected-row/result mapping; ORM result shapes can differ from raw
  D1 statements even when the SQL is equivalent.
- [ ] Preserve schema-discovery safeguards in tenant purge; replacing discovery
  with a hand-maintained list would weaken its ability to catch omitted tables.
- [ ] Run all affected model/service tests and `npm run verify`.
**Acceptance:** Easier-to-maintain queries without weakened isolation, quotas,
idempotency, ordering, or rollback behavior. No direct SQL is retained solely
because it is already written.

## 4. Behavior-Focused Tests Without Weakening TDD

### Correct interpretation
A short function can enforce an important contract. The pricing URL helper is
small, but its output is an external navigation contract worth testing.
Conversely, a long test can provide little confidence if it only repeats the
implementation's internal call sequence.
Testing Library recommends testing software as it is used. Google's testing
guidance warns against change-detector tests that mirror implementation rather
than expected behavior. These are design principles, not permission to delete
tests to obtain green. [S9, S10]
The earlier assessment that the suite was generally strong was based on inspected
examples, not a complete test-quality audit. Use the following criteria on each
test rather than making a blanket decision about the suite.

### Rules

- Name the observable behavior and the defect the test would detect.
- Prefer outputs, HTTP responses, rendered semantic content, persisted state,
  and externally visible effects over internal helper choreography.
- Test one coherent behavior per case; multiple assertions are fine when they
  jointly prove that behavior. A word such as "and" in a title is not a reliable
  substitute for deciding whether the case contains unrelated behaviors.
- Keep edge cases for money, security, lifecycle transitions, isolation,
  concurrency, and retries even when the implementation looks obvious.
- Use real local bindings for adapter integration. Fake ports can isolate a
  use-case decision; fake external HTTP can exercise adapter error handling.
- Call assertions are legitimate for an actual boundary contract, such as the
  requested HTTP method/body or absence of a forbidden send. They are not enough
  when the protected behavior is a resulting database state.
- Assertions on DOM roles, accessible labels, and nearby values are preferable
  to finding arbitrary digits somewhere in serialized HTML.
- HTML length checks may detect empty renders but never prove the right values
  appear in the right place. Keep meaningful assertions alongside them.
- A rendered Polaris tag is not proof of the component's browser behavior.
  Record the required browser/manual checks rather than inventing coverage.
- Keep architecture/config/launch contracts distinct from product behavior.
  A source/config check is useful when it enforces an intentional constraint,
  not when it merely freezes formatting or today's implementation.

### Existing examples to examine

| Location | Assessment/action |
| --- | --- |
| `app/models/entitlements.test.ts` | Preserve concurrency, replay, revision, and tenant tests; strengthen persisted-state assertions if missing |
| `app/billing/pricing-plans-url.test.ts` | Preserve the external URL contract despite the helper being small |
| `app/billing/plans.test.ts` | Separate intentional free-plan/pricing invariants from assertions freezing exactly free/pro and placeholder names |
| `scripts/check-placeholders.test.mjs` | Preserve rejection of launch placeholders; use fixture configurations so adopting real branding does not require weakening the guard |
| `app/routes/internal/dashboard.render.test.tsx` | Bare `"10"`, `"4"`, or `"6"` matches can find unrelated markup; assert counts in their labeled context |
| `app/emails/templates/admin-password-reset.test.ts` | Keep reset URL in HTML/text, escaping, language, and visible branding; length alone is not content coverage |
Placeholder assertions are not automatically good launch guards. A test requiring
the live plan catalog to keep names starting with a placeholder prevents valid
template adoption. Preserve the safety intention by testing placeholder rejection
on fixture inputs and valid real configuration acceptance, not by silently
deleting the assertion.

### Task 4: Clarify test rules and strengthen named cases
**Files:** `.claude/rules/testing.md`, `AGENTS.md` only if its summary needs
alignment, and the tests listed above. Do not change unrelated production code.
**Produces:** Clearer testing guidance and stronger regression protection,
not a lower test count or a lower coverage target.

- [ ] Propose wording changes to the existing rule before applying them. Resolve
  the current "every new function" and mechanical test-title wording toward
  behavioral coverage without waiving mandatory RED for new behavior/bug fixes.
- [ ] For each candidate, record the behavior, current assertion, how it could
  pass with broken behavior, and the stronger replacement assertion.
- [ ] Demonstrate a weak dashboard assertion with a render fixture containing
  the expected digits elsewhere but an incorrect labeled count; strengthen the
  assertion so that mismatch is detected.
- [ ] Keep fixture-based placeholder rejection and valid-config acceptance tests
  when moving identity or making the plan registry app-specific.
- [ ] Parameterize genuinely repetitive boundary cases where readability improves;
  retain diagnostic case names and every meaningful scenario.
- [ ] Do not remove source checks, call assertions, or snapshots by category.
  First identify whether they protect a genuine architectural/boundary contract.
- [ ] Obtain explicit approval for intentional removal of protection. A test
  rewrite must preserve or strengthen the named requirement.
- [ ] Run the affected test projects and the full verification command. Report
  tests actually run, failures, and any browser behavior not exercised.
**Acceptance:** Tests fail for wrong behavior and tolerate harmless internal
refactors. No security, isolation, launch, or retry protection is lost.

## Verification And Handoff
Run commands from the repository root. Do not claim their expected outcome as
an observed result until execution actually finishes.

```sh
# Model/Workers tests after database changes
npx vitest run app/models/entitlements.test.ts

# Existing DOM-config tests after i18n/UI changes
npx vitest run --config vitest.dom.config.ts app/i18n/render.test.tsx

# Node-based launch checks are separate from the Vitest commands
node --test scripts/check-placeholders.test.mjs

# Typecheck, lint, Workers suite, and DOM suite
npm run verify

# Production-readiness check, not expected to pass for an unconfigured template
npm run check:placeholders
```
Check which project owns any newly added render test before running it. A command
reporting no matching tests is not evidence of success. The existing
`npm run verify` does not by itself mean every standalone Node script test ran.
For a configured deployment, verify the production build and live pricing flow
only with the appropriate environment and account. Never deploy as part of this
documentation task or send real emails from automated tests.
Each implementation handoff must include:

1. Files changed and the exact rule/behavior addressed.
2. Observed RED/GREEN evidence for new behavior or bug fixes; baseline/final
   green evidence for pure refactors.
3. Full command results, including separate Node tests where applicable.
4. Remaining SQL exceptions and incomplete inventory categories.
5. Any unresolved environment, account, manual-browser, or launch blockers.
Recommended delivery order: approve linked rule wording; consolidate identity;
audit identifier use; migrate ordinary SQL; migrate guarded writes only with
equivalence evidence. Improve the relevant tests within each task rather than
postponing testing to a final cleanup pass. Each task can be reviewed separately.

## Sources
Shopify facts were researched through the Shopify AI Toolkit. Drizzle,
Cloudflare, and testing guidance use their official documentation or original
publisher. These sources support technical facts; the proposed repository rules
are our engineering choices, not claims that Shopify mandates Drizzle or TDD.

- **S1:** [Shopify app configuration](https://shopify.dev/docs/apps/build/cli-for-apps/app-configuration)
- **S2:** [Manage app credentials](https://shopify.dev/docs/apps/build/authentication-authorization/manage-credentials)
- **S3:** [Shopify App Pricing](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing)
- **S4:** [Admin GraphQL App, 2026-07](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/App)
- **S5:** [Manage app configuration files](https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files)
- **S6:** [Test apps locally, team development](https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally)
- **S7:** [Drizzle SQLite SQL](https://orm.drizzle.team/docs/sqlite/sql) and [batch API](https://orm.drizzle.team/docs/sqlite/batch-api)
- **S8:** [Cloudflare D1 database and batch API](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- **S9:** [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles/)
- **S10:** [Google: Change-Detector Tests Considered Harmful](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html)
- **S11:** [Shopify App Store branding guidance](https://shopify.dev/docs/apps/launch/shopify-app-store/best-practices)
- **S12:** [Shopify support requirements](https://shopify.dev/docs/apps/launch/distribution/support-your-customers)
- **S13:** [Current authenticated app installation](https://shopify.dev/docs/api/admin-graphql/2026-07/queries/currentAppInstallation)
- **S14:** [Partner Active Subscription API and ID examples](https://shopify.dev/docs/api/partner/2026-07/active-subscription)
- **S15:** [Partner Historical Events API and subject ID examples](https://shopify.dev/docs/api/partner/2026-07/historical-events)
- **S16:** [Legacy Partner app query and its ID namespace](https://shopify.dev/docs/api/partner/2026-07/queries/app)
- **S17:** [Partner API authentication](https://shopify.dev/docs/api/partner/2026-07)
- **S18:** [Build a Billing Event: pricing redirect instructions](https://shopify.dev/docs/apps/launch/billing/shopify-app-pricing/subscription-billing/build-billing-event)
