# Task 3 Report

## Changes

- Added `AdminUserPort` and `PasswordResetTokenPort`.
- Moved admin identity repository bindings into `app/wiring.server.ts`.
- Injected narrow dependency objects into credential, admin-management, and password-reset use cases.
- Added RED/GREEN credential test using in-memory `AdminUserPort`; verifies successful login records through port.

## TDD Evidence

- RED: `npx vitest run app/services/admin-auth.test.ts` failed with `getDb() called outside of a request context`, because `verifyAdminCredentials` still constructed `AdminUserRepo` instead of using injected port.
- GREEN: same test passed after port injection.

## Verification

- `npx vitest run app/services/admin-auth.test.ts` — 29 passed.
- `npx vitest run app/services/admin-management.test.ts` — 25 passed.
- `npx vitest run app/services/password-reset.test.ts` — 19 passed.
- `npm run typecheck` — passed.

## Re-review follow-up

- Added `updateOwnProfile` in-memory user-port test outside `runWithRequestContext`.
- Added `checkResetToken` in-memory token-port test outside `runWithRequestContext`.
- RED confirmed by intentional assertion failure in admin-management test; corrected assertion and both tests pass.
- Focused injection tests: 2 passed.
- Current workspace `npm run typecheck` is blocked by unrelated concurrent AI/support/scheduled changes (`app/ai/task.test.ts`, support routes/tests, `workers/app.ts`).
- `rg '^import .*~/models' app/services/admin-auth.server.ts app/services/admin-management.server.ts app/services/password-reset.server.ts` — no output.

## Review follow-up

- Removed service defaults and `~/wiring.server` imports; all route and integration callsites now pass adapters explicitly.
- Added explicit `AdminUserPort`/`PasswordResetTokenPort` dependencies to session guards, admin intents, profile, login, and reset flows.
- Removed unused `PasswordResetTokenPort.cleanup`; scheduled repository cleanup remains adapter-owned until its own port-injection task.
- `npx vitest run app/services/admin-auth.test.ts app/services/admin-management.test.ts app/services/password-reset.test.ts` — 73 passed.
- `npx vitest run app/notifications/notify.integration.test.ts app/services/support.test.ts` — 38 passed.
- `npm run typecheck` — passed.
