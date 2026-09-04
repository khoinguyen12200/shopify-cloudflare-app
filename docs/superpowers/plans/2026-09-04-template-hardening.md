# Shopify Cloudflare Template Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the confirmed defects in `docs/AUDIT.md` and leave a secure, testable, reusable Shopify-on-Cloudflare starter with explicit adoption gates.

**Architecture:** Preserve the existing clean-architecture rings. Business decisions stay pure, external data is parsed at entry boundaries, D1 remains behind repository ports, and all adapter construction moves into the composition root. Work is divided into dependency waves so multiple agents can operate in isolated worktrees without editing the same files concurrently.

**Tech Stack:** TypeScript 6, React Router 7, Shopify App React Router, Polaris web components, Cloudflare Workers/D1/KV/R2/Queues/Rate Limiting, Drizzle ORM, Zod 4, Vitest Workers pool, ESLint 10.

**Spec:** `docs/AUDIT.md`

## Global Constraints

- Read `AGENTS.md` and all applicable `.claude/rules/*` files before editing.
- Use an isolated git worktree per agent. Never let parallel agents edit the shared checkout.
- Follow strict RED -> verify RED -> GREEN -> verify GREEN -> REFACTOR for every behavior change.
- Tests use real local D1, KV, R2, and Queue bindings. Fake only the outermost external HTTP boundary.
- Before changing Shopify API/config/UI behavior, invoke the matching Shopify skill and use its documentation search and validation loop.
- Before changing Cloudflare configuration or bindings, invoke the Cloudflare/Wrangler skills and validate against the installed Wrangler schema.
- Do not use `any`, type assertions, `@ts-ignore`, lint suppression, skipped tests, or weakened assertions.
- Do not change legal copy, plan policy, AI entitlement policy, deployment provider, or customer-data policy as if one answer fits every derived app.
- Each task gets its own commit. The integration controller cherry-picks completed commits in the order specified below.
- After every wave, run `npm run verify`. After changes to `wrangler.jsonc`, run `npm run cf-typegen` and include the generated type changes if the repository tracks them.
- If a task grows a production file beyond 700 lines or a function beyond 60 lines, split it before adding behavior.

## Multi-Agent Execution Model

Use one controller and up to three implementation agents. Each agent starts from the integration branch at the beginning of its wave.

| Wave | Agent A | Agent B | Agent C | Integration order |
|---|---|---|---|---|
| 0 | Baseline and worktrees | - | - | Controller only |
| 1 | Task 1: SSR promises | Task 2: external parsing | Task 3: upload controller | 1, 2, 3 |
| 2 | Task 4: orphan cleanup | Task 5: headers/styles | Task 6: caught-error logs | 4, 5, 6 |
| 3 | Task 7: auth abuse/logout | - | - | Exclusive |
| 4 | Task 8: secrets/config/log privacy | Task 9: webhook lifecycle | Task 10: operations/adoption docs | 8, 9, 10 |
| 5 | Task 11: composition root | - | - | Exclusive |
| 6 | Task 12: final verification/review | - | - | Controller only |

Tasks in a wave have disjoint primary file ownership. If an agent discovers it must edit a file owned by another task in the same wave, it records the requested change in its handoff instead of editing that file. The controller applies that small integration change after cherry-picking.

## Phase 0: Baseline and Isolation

### Task 0: Establish the execution baseline

**Owner:** Integration controller

**Files:**
- Read: `AGENTS.md`
- Read: `docs/AUDIT.md`
- Read: `.claude/rules/testing.md`
- Read: `.claude/rules/architecture.md`
- Read: `.claude/rules/cloudflare.md`
- Create per-agent worktrees outside the repository directory

**Interfaces:**
- Consumes: current integration branch
- Produces: verified baseline commit SHA and clean worktrees for Wave 1

- [ ] Record `git status --short` and stop if unexpected changes appear.
- [ ] Record the baseline with `git rev-parse HEAD`.
- [ ] Run `npm run verify` and save the exact test count and failures, if any.
- [ ] Run `CLOUDFLARE_ENV=production npm run build` and record the result.
- [ ] Create one branch/worktree per Wave 1 task using the `using-git-worktrees` skill.
- [ ] Give each agent only its task section, the Global Constraints, baseline SHA, and owned files.

Expected result: no source changes; a known baseline against which every task can be reviewed.

## Phase 1: Independent Boundary Corrections

### Task 1: Observe SSR stream settlement and enable promise linting

**Owner:** Agent A

**Audit coverage:** B1

**Files:**
- Create: `app/lib/promise-settlement.ts`
- Create: `app/lib/promise-settlement.test.ts`
- Modify: `app/entry.server.tsx`
- Modify: `eslint.config.js`
- Modify: `tsconfig.json` only if required for type-aware ESLint project discovery

**Interfaces:**
- Produces:
  ```ts
  export function onPromiseSettled(
    promise: Promise<unknown>,
    callback: () => void,
  ): void;
  ```

- [ ] Write tests named `calls cleanup after resolution` and `calls cleanup after rejection` using deferred promises.
- [ ] Run `npx vitest run app/lib/promise-settlement.test.ts` and verify RED because `onPromiseSettled` does not exist.
- [ ] Implement `onPromiseSettled` with both fulfillment and rejection handlers; the returned chain must be explicitly observed.
- [ ] Replace `stream.allReady.then(() => clearTimeout(timeout))` with the helper.
- [ ] Run the targeted test and verify GREEN with no unhandled rejection output.
- [ ] Enable `@typescript-eslint/no-floating-promises` and `@typescript-eslint/no-misused-promises` using type-aware parser configuration.
- [ ] Run `npm run lint` and fix legitimate violations without disabling either rule.
- [ ] Run `npm run typecheck` and the targeted test.
- [ ] Commit with `fix: observe server render settlement`.

### Task 2: Parse external webhook and Shopify GraphQL payloads

**Owner:** Agent B

**Audit coverage:** B11

**Files:**
- Create: `app/schemas/compliance-webhook.ts`
- Create: `app/schemas/current-app-installation.ts`
- Create: `app/schemas/external-inputs.test.ts`
- Modify: `app/routes/webhooks/compliance.tsx`
- Modify: `app/routes/webhooks/compliance.test.ts`
- Modify: `app/routes/app/billing.tsx`
- Modify: `app/routes/app/billing.render.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const compliancePayloadSchema: z.ZodType<Record<string, unknown>>;
  export const currentAppInstallationSchema: z.ZodType<{
    data: { currentAppInstallation: { app: { handle: string } } };
  }>;
  ```

- [ ] Invoke `shopify-admin` and look up the current-app-installation query shape before editing the billing route.
- [ ] Add malformed-payload tests: compliance rejects a non-object payload with 400; missing GraphQL handle produces a controlled 502 or explicit degraded result.
- [ ] Run the relevant test files and verify RED for unchecked payload behavior.
- [ ] Implement the two Zod schemas without coercing malformed values into valid ones.
- [ ] Parse at the entry boundary and remove the existing production type assertions.
- [ ] Log stable parse-failure event names without including raw payloads.
- [ ] Run targeted tests and verify GREEN.
- [ ] Run `npm run typecheck` and `npm run lint`.
- [ ] Commit with `fix: validate external response payloads`.

### Task 3: Separate upload orchestration from the attachment component

**Owner:** Agent C

**Audit coverage:** B12

**Files:**
- Create: `app/routes/app/support/use-pending-uploads.ts`
- Create: `app/routes/app/support/use-pending-uploads.test.tsx`
- Create: `app/schemas/support-upload.ts`
- Modify: `app/components/support/AttachmentPicker.tsx`
- Modify: `app/components/support/InternalAttachmentPicker.tsx`
- Modify: `app/routes/app/support/new.tsx`
- Modify: `app/routes/app/support/detail.tsx`
- Modify: `app/routes/internal/support/detail.tsx`
- Modify related render tests beside those routes/components

**Interfaces:**
- Produces:
  ```ts
  export interface UploadController {
    readonly files: readonly PendingUpload[];
    readonly busy: boolean;
    readonly error: string | null;
    add(files: FileList | null): Promise<void>;
    remove(uploadId: string): void;
    reset(): void;
  }

  export function usePendingUploads(ticketId?: string): UploadController;

  export const storedUploadSchema: z.ZodType<{
    uploadId: string;
    r2Key: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
  }>;
  ```
- The component consumes `UploadController`; it does not import or call `fetch`.

- [ ] Add a render/contract test proving `AttachmentPicker` operates from passed controller state and callbacks.
- [ ] Add hook tests for successful upload, malformed success JSON, rejected upload, file validation, maximum file count, and object-URL cleanup.
- [ ] Run the new tests and verify RED because the route-local hook does not exist.
- [ ] Add `storedUploadSchema`, parse successful response JSON in the hook, and map malformed JSON to `upload_failed`.
- [ ] Move upload state/network orchestration to the route-local hook without changing request headers or streaming behavior.
- [ ] Convert attachment components to props-in/JSX-out presentation.
- [ ] Update merchant and internal routes to create and pass the controller.
- [ ] Run affected render tests and verify GREEN.
- [ ] Confirm `rg -n "fetch\\(" app/components` finds no attachment-component fetch.
- [ ] Commit with `refactor: separate support upload controller`.

### Wave 1 integration gate

- [ ] Cherry-pick Tasks 1, 2, and 3 in that order.
- [ ] Confirm the three commits have no overlapping production files before cherry-picking.
- [ ] Run `npm run verify`.
- [ ] Run `CLOUDFLARE_ENV=production npm run build`.
- [ ] Review the combined diff before creating Wave 2 worktrees.

## Phase 2: Runtime Safety and Surface Isolation

### Task 4: Implement expired pending-upload cleanup

**Owner:** Agent A

**Audit coverage:** B3

**Files:**
- Modify: `app/ports/scheduled.ts`
- Modify: `app/models/support.server.ts`
- Modify: `app/models/support.test.ts`
- Modify: `app/services/scheduled.server.ts`
- Modify: `app/services/scheduled.test.ts`
- Modify: `app/wiring.server.ts`
- Modify: `app/routes/resources/support-upload.tsx` comment only

**Interfaces:**
- Produces:
  ```ts
  export interface ExpiredUpload {
    readonly id: string;
    readonly r2Key: string;
  }

  listExpiredUploads(cutoff: number): Promise<readonly ExpiredUpload[]>;
  deleteExpiredUploads(ids: readonly string[], cutoff: number): Promise<number>;
  deleteUploadObjects(keys: readonly string[]): Promise<void>;
  ```

- [ ] Add a model test with expired, unexpired, and other-shop rows proving only expired rows are selected and conditionally deleted.
- [ ] Add a scheduled-service test proving operation order is list -> R2 delete -> D1 delete.
- [ ] Add a failure test proving an R2 deletion failure leaves D1 rows available for the next cron tick and logs `cron.sweep_failed`.
- [ ] Run the tests and verify RED because scheduled upload dependencies do not exist.
- [ ] Implement the repository methods with expiry predicates on both selection and deletion.
- [ ] Add the upload sweep to `runScheduledSweeps`; skip binding calls for an empty key list.
- [ ] Wire the methods through `scheduledDependencies()`.
- [ ] Correct the upload-route comment to name `runScheduledSweeps` rather than claiming behavior in `workers/app.ts` directly.
- [ ] Run targeted tests and `npm run verify`.
- [ ] Commit with `fix: sweep expired support uploads`.

### Task 5: Add route-aware security headers and remove root stylesheet leakage

**Owner:** Agent B

**Audit coverage:** B13 plus the security-header gap recorded in the executive assessment

**Files:**
- Create: `app/security/response-headers.ts`
- Create: `app/security/response-headers.test.ts`
- Modify: `app/entry.server.tsx`
- Modify: `app/root.tsx`
- Modify: `app/routes/public/_layout.tsx`
- Modify: `app/routes/app/_layout.tsx`
- Modify relevant route render tests

**Interfaces:**
- Produces:
  ```ts
  export function applySecurityHeaders(
    request: Request,
    headers: Headers,
  ): Headers;
  ```

- [ ] Write tests for all routes: `nosniff` and referrer policy always; HSTS only on HTTPS; internal routes deny framing; embedded `/app` retains Shopify's frame policy; public CSP permits only assets actually used by the public layout.
- [ ] Run the header tests and verify RED.
- [ ] Implement route-aware headers. Do not overwrite headers set by `addDocumentResponseHeaders` for embedded Shopify pages.
- [ ] Remove the Shopify Inter stylesheet and preconnect from `app/root.tsx`.
- [ ] If embedded Polaris requires that font link according to current Shopify documentation, place it in `app/routes/app/_layout.tsx`; otherwise omit it. Public pages continue using their SCSS font tokens, and internal pages retain `INTERNAL_FONT_LINKS`.
- [ ] Add/adjust render tests proving root no longer owns a stylesheet and each surface owns only its assets.
- [ ] Run targeted tests, `npm run lint`, and `npm run typecheck`.
- [ ] Commit with `fix: isolate surface assets and headers`.

### Task 6: Make caught failures observable

**Owner:** Agent C

**Audit coverage:** B14

**Files:**
- Modify: `app/routes/resources/ai-draft.tsx`
- Create or modify: `app/routes/resources/ai-draft.test.ts`
- Modify: `app/services/webhook-queue.ts`
- Modify: `app/services/webhook-queue.test.ts`

**Interfaces:**
- Produces stable events:
  - `ai.draft_cancel_failed`
  - `webhook.queue_retry_failed`
  - `webhook.queue_ack_failed`

- [ ] Add tests that inject failures into each currently empty catch path and capture `console.error`.
- [ ] Assert the stable event, non-sensitive identifiers, and error message; assert the route/service outcome remains correct.
- [ ] Run targeted tests and verify RED because no structured event is emitted.
- [ ] Add structured logging without swallowing a correctness-critical failure.
- [ ] Run targeted tests and verify GREEN with no stray console output from successful paths.
- [ ] Commit with `fix: record degraded async failures`.

### Wave 2 integration gate

- [ ] Cherry-pick Tasks 4, 5, and 6 in that order.
- [ ] Preserve Task 1's promise-settlement helper when resolving `entry.server.tsx`.
- [ ] Run `npm run verify` and the production build.

## Phase 3: Authentication Hardening

### Task 7: Rate-limit internal authentication and make logout POST-only

**Owner:** One exclusive agent

**Audit coverage:** B4, B5

**Files:**
- Create: `app/ports/auth-rate-limit.ts`
- Create: `app/lib/auth-client-key.ts`
- Create: `app/lib/auth-client-key.test.ts`
- Modify: `app/wiring.server.ts`
- Modify: `app/routes/internal/login.tsx`
- Create: `app/routes/internal/login.test.ts`
- Modify: `app/routes/internal/forgot-password.tsx`
- Create: `app/routes/internal/forgot-password.test.ts`
- Modify: `app/routes/internal/logout.tsx`
- Create: `app/routes/internal/logout.test.ts`
- Modify: `wrangler.jsonc`
- Regenerate: `worker-configuration.d.ts` if tracked

**Interfaces:**
- Produces:
  ```ts
  export interface AuthAttemptLimiter {
    check(key: string): Promise<"allowed" | "limited" | "unavailable">;
  }

  export function authClientKey(request: Request): string;

  export function authLimiters(): {
    readonly login: AuthAttemptLimiter;
    readonly passwordReset: AuthAttemptLimiter;
  };
  ```

- [ ] Validate the current Wrangler Rate Limiting binding schema using the Wrangler skill.
- [ ] Write unit tests proving `authClientKey` uses Cloudflare's connecting-IP header and a deterministic local fallback without logging the raw address.
- [ ] Write route tests proving the sixth login attempt and fourth reset attempt from one key return 429 before password hashing or email work.
- [ ] Write tests for the chosen missing-binding behavior: local development remains usable; production-like configuration returns 503 rather than silently disabling protection.
- [ ] Write a logout test proving GET returns 405 without `Set-Cookie`, while POST clears the cookie and redirects.
- [ ] Run tests and verify RED.
- [ ] Add `LOGIN_LIMITER` and `RESET_LIMITER` to both local and production `ratelimits` arrays with unique namespace IDs.
- [ ] Implement narrow limiter adapters in the composition root and invoke them at the start of both actions.
- [ ] Make logout loader return 405 and keep session destruction in the action.
- [ ] Run `npm run cf-typegen`, targeted tests, and `npm run verify`.
- [ ] Commit with `fix: protect internal authentication endpoints`.

## Phase 4: Configuration, Webhook Correctness, and Operations

### Task 8: Separate attachment secrets, enforce environment parity, and hash compliance logs

**Owner:** Agent A

**Audit coverage:** B6, B7, B8

**Files:**
- Create: `app/observability/shop-log.ts`
- Create: `app/observability/shop-log.test.ts`
- Modify: `app/services/webhook-logging.ts`
- Modify: `app/services/webhook-logging.test.ts`
- Modify: `app/services/compliance.server.ts`
- Modify: `app/services/compliance.test.ts`
- Modify: `app/wiring.server.ts`
- Modify: `wrangler.jsonc`
- Modify: `.dev.vars.example`
- Modify: `scripts/check-placeholders.mjs`
- Modify or create: `scripts/check-placeholders.test.mjs`
- Regenerate: `worker-configuration.d.ts` if tracked

**Interfaces:**
- Produces:
  ```ts
  export async function hashShop(shop: string): Promise<string>;
  export async function shopLog(
    event: string,
    shop: string,
    fields?: Readonly<Record<string, string | number | boolean | null>>,
  ): Promise<void>;
  ```

- [ ] Write tests proving the logger emits the same stable hash for the same shop, never emits the raw shop, and preserves allowed fields.
- [ ] Write a configuration test fixture where a top-level var or binding is absent in production and verify the checker fails with its exact key.
- [ ] Write a wiring/config test proving attachment signing fails when `ATTACHMENT_TOKEN_SECRET` is absent and never reads `SHOPIFY_API_SECRET`.
- [ ] Run tests and verify RED.
- [ ] Add `ATTACHMENT_TOKEN_SECRET` to required secrets in both environments and document generation in `.dev.vars.example`.
- [ ] Add `AI_GATEWAY_ID` to production vars and implement structural parity checks for required vars/bindings while allowing documented environment-specific values.
- [ ] Reuse `hashShop` from webhook and compliance log paths.
- [ ] Run `npm run cf-typegen`, script tests, targeted tests, `npm run verify`, and `npm run check:placeholders` expecting failure only when intentional production placeholders remain.
- [ ] Commit with `fix: isolate secrets and enforce config parity`.

### Task 9: Introduce a typed webhook registry and delivery state machine

**Owner:** Agent B

**Audit coverage:** B9, B10

**Files:**
- Create: `app/domain/webhook-delivery-lifecycle.ts`
- Create: `app/domain/webhook-delivery-lifecycle.test.ts`
- Modify: `app/ports/webhook-deliveries.ts`
- Modify: `app/services/webhook-consumer.ts`
- Modify: `app/services/webhook-consumer.test.ts`
- Modify: `app/models/webhook-deliveries.server.ts`
- Modify: `app/models/webhook-deliveries.test.ts`
- Modify: `app/wiring.server.ts`

**Interfaces:**
- Produces:
  ```ts
  export type WebhookTopic = "app/uninstalled" | "app/scopes_update";
  export type WebhookDeliveryStatus =
    | "received"
    | "queued"
    | "processing"
    | "processed"
    | "failed"
    | "dead_letter";

  export type WebhookTransitionEvent =
    | { readonly type: "queue" }
    | { readonly type: "claim"; readonly now: number; readonly leaseMs: number }
    | { readonly type: "complete"; readonly now: number }
    | { readonly type: "fail"; readonly now: number }
    | { readonly type: "dead_letter"; readonly now: number };

  export function transitionWebhookDelivery(
    state: Readonly<{ status: WebhookDeliveryStatus; processingStartedAt: number | null }>,
    event: WebhookTransitionEvent,
  ): Result<Readonly<{ from: WebhookDeliveryStatus; to: WebhookDeliveryStatus }>, "illegal_transition" | "lease_active">;
  ```

- [ ] Add exhaustive unit tests for every legal transition, terminal state, illegal transition, active lease, and expired lease.
- [ ] Add a compile-time registry test or `satisfies Record<WebhookTopic, Handler>` fixture proving a missing handler is rejected.
- [ ] Add a consumer test proving an unknown stored topic is marked dead-letter/unsupported once and returned as `outcome: "unsupported"` without throwing for retries.
- [ ] Add repository integration tests proving compare-and-set transition conflicts do not overwrite a newer state.
- [ ] Run tests and verify RED.
- [ ] Move lifecycle policy and lease duration out of the repository into the domain/service layer.
- [ ] Replace `Record<string, Handler>` with a static `Record<WebhookTopic, Handler>` registry.
- [ ] Keep raw stored topics as strings at the database edge so retired topics can be handled explicitly.
- [ ] Persist transitions using guarded updates based on the decision's `from` status; return a conflict value when another consumer wins.
- [ ] Run targeted tests and `npm run verify`.
- [ ] Commit with `refactor: model webhook delivery lifecycle`.

### Task 10: Add reusable operations and adoption documentation

**Owner:** Agent C

**Audit coverage:** intentional seams and adoption checklist

**Files:**
- Create: `docs/OPERATIONS.md`
- Create: `docs/ADOPTING_THE_TEMPLATE.md`
- Modify: `README.md`
- Modify: `docs/AUDIT.md` only to link the two new documents and mark addressed documentation gaps

**Interfaces:**
- Produces documented commands and decisions; no runtime code.

- [ ] Document deploy prerequisites, migration order, rollback, D1 backup/restore, cron failure investigation, R2 cleanup verification, secret rotation, and DLQ inspection/replay using commands verified against the installed Wrangler CLI.
- [ ] Document the adoption gates: app IDs/URLs/scopes, legal and translated copy, billing plans, AI gate policy, customer-data inventory/compliance handlers, production resources, alerts, and current App Store self-review.
- [ ] Clearly label public client IDs as non-secret and API/attachment/session secrets as secret.
- [ ] State that deployment automation is organization-specific; provide required properties rather than a nonfunctional workflow.
- [ ] Run every read-only command shown with `--help` or an equivalent syntax check. Mark commands requiring credentials as operator-run and do not execute them.
- [ ] Search the two guides for placeholder markers, the misspelled Cloudflare token name, and the nonexistent health route; ensure none remains.
- [ ] Commit with `docs: add template adoption and operations guides`.

### Wave 4 integration gate

- [ ] Cherry-pick Tasks 8, 9, and 10 in that order.
- [ ] Resolve `app/wiring.server.ts` by preserving both the secret/logging changes and webhook registry changes.
- [ ] Run `npm run cf-typegen`, `npm run verify`, and the production build.
- [ ] Confirm documentation commands still match the integrated package scripts and Wrangler version.

## Phase 5: Composition Root Enforcement

### Task 11: Move all production adapter construction into wiring

**Owner:** One exclusive agent after all behavior tasks are integrated

**Audit coverage:** B2

**Files:**
- Modify: `app/wiring.server.ts`
- Optionally create: `app/wiring/admin.server.ts`, `app/wiring/merchant.server.ts`, `app/wiring/notifications.server.ts`, `app/wiring/webhooks.server.ts`
- Modify every production file returned by:
  ```bash
  rg -l 'new [A-Za-z][A-Za-z0-9]*Repo\(' app \
    --glob '!**/*.test.*' \
    --glob '!app/models/**' \
    --glob '!app/wiring*.server.ts' \
    --glob '!app/wiring/**'
  ```
- Modify: `eslint.config.js`
- Modify/add tests beside affected services and routes

**Interfaces:**
- Produces narrow dependency accessors from the `app/wiring.server.ts` facade.
- Production routes/services must not import `~/models/*.server`.

- [ ] Capture the exact pre-change list of model imports and repository constructors outside wiring.
- [ ] Group consumers by surface: Shopify lifecycle, merchant app, internal console, resources, notifications, and webhooks.
- [ ] For each group, write or update a dependency-injection test that fails when the consumer constructs its own repository.
- [ ] Run the affected test and verify RED before moving each group.
- [ ] Add narrow port-shaped factories in wiring. Do not expose concrete repository classes or a generic service locator.
- [ ] Update routes to parse -> obtain dependencies -> call the existing use case/query function -> respond.
- [ ] Update ring-3 notification code to receive repository ports rather than import models.
- [ ] Add an ESLint override using `no-restricted-imports` that bans model imports from production files outside `app/models/**` and wiring, while allowing tests to construct real repositories.
- [ ] Run `rg` with the command above and verify it returns no files.
- [ ] Run `rg -n 'from "~/models/' app/services app/notifications app/routes app/shopify.server.ts` and verify it returns no production imports.
- [ ] Run targeted tests after each surface group, then `npm run verify`.
- [ ] Commit with `refactor: enforce the composition root`.

## Phase 6: Final Verification and Review

### Task 12: Prove the integrated template meets the plan

**Owner:** Integration controller plus a fresh code-review agent

**Files:**
- Review all files changed since the baseline SHA
- Modify only files required to address review findings, using fresh failing tests for behavior fixes

**Interfaces:**
- Consumes: all prior task commits
- Produces: final verification record and updated audit status

- [ ] Run `git diff --check <baseline>..HEAD`.
- [ ] Run `npm run cf-typegen` and verify no unexplained generated diff appears.
- [ ] Run `npm run verify` and record the exact passing test count.
- [ ] Run `CLOUDFLARE_ENV=production npm run build`.
- [ ] Run `npm run check:placeholders production`; intentional adoption placeholders must fail with a clear list, while structural config errors must be distinguishable.
- [ ] Run searches for forbidden production patterns:
  ```bash
  rg -n 'catch\s*\{\s*\}' app workers
  rg -n 'from "~/models/' app/services app/notifications app/routes app/shopify.server.ts
  rg -n '\bas any\b|@ts-ignore|eslint-disable' app workers
  rg -n '\.(skip|todo|only)\(' app
  ```
- [ ] Dispatch a fresh reviewer with the baseline SHA, head SHA, `docs/AUDIT.md`, and this plan. Require findings first, ordered by severity.
- [ ] Address critical/important review findings through the TDD cycle and rerun all verification commands.
- [ ] Update `docs/AUDIT.md` statuses to `resolved`, `accepted template seam`, or `remaining`, with commit references.
- [ ] Run `git status --short` and report every remaining change honestly.

## Agent Handoff Template

Give each implementation agent this exact structure with its assigned task inserted:

```text
Implement Task N from docs/superpowers/plans/2026-09-04-template-hardening.md.

Baseline: <integration SHA at start of wave>
Owned files: <copy the task file list>
Do not edit files owned by another task in this wave. Record cross-task changes in your handoff.

Required:
1. Read AGENTS.md and applicable .claude/rules files.
2. Use every skill named by the task.
3. Follow RED -> verify RED -> GREEN -> verify GREEN.
4. Run the task's targeted checks.
5. Self-review the diff against the task acceptance criteria.
6. Commit with the specified message.

Return:
- root cause/design summary
- RED command and observed failure
- GREEN command and observed result
- verification commands and results
- commit SHA
- files changed
- integration notes or requested cross-task edits
```

## Completion Definition

The hardening effort is complete only when Tasks 1-12 are integrated, the full verification suite and production build pass from a clean worktree, the final reviewer has no unresolved critical/important findings, and `docs/AUDIT.md` records the remaining app-specific adoption work without presenting it as a defect in the base.
