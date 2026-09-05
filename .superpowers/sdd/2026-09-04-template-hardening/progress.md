# SDD ledger — plan: docs/superpowers/plans/2026-09-04-template-hardening.md

Baseline: `4ec104e` (pre-plan source baseline: `8392be6`).

Ruling: The audit and execution plan were committed as the isolated-branch baseline before implementation. They are required task inputs, and committing them avoids copying untracked files into agent worktrees. Cost if wrong: documentation baseline and application baseline are one commit apart.

## Preflight Scan

| Tasks | Shared file/interface | Finding/ruling |
| --- | --- | --- |
| 1 + 5 | `app/entry.server.tsx` | Sequential waves; Task 5 preserves Task 1's helper. |
| 4 + 8 + 9 + 11 | `app/wiring.server.ts` | Sequential waves; integrate in stated order. |
| 1 + 11 | `eslint.config.js` | Sequential waves; Task 11 builds on promise-lint configuration. |
| 5 + 10 + 12 | `docs/AUDIT.md` | Sequential tasks; final status updates are authoritative. |
| 7 + 8 | `wrangler.jsonc` | Sequential waves; both regenerate types. |
| Task 1 | Self-consistency | Helper tests precede helper implementation and entry replacement. |
Task 1: minor (deferred): Targeted test process still emits existing test-environment missing-secret/AI-binding warnings; address or explicitly retain in final verification.
Task 1: complete (commits 4ec104e..a4e455d, review clean).
Task 2: complete (commits 4ec104e..0ebf818, review clean after 2 fix rounds).
Task 3: complete (commits 4ec104e..1d3a682, review clean after 2 fix rounds).

Task 4: complete (commits 67b270e..fdda583, review clean after 1 fix round).
Task 5: complete (commit 84429ad; integrated as 0bcd70c). RED: helper missing/root asset tests failed; GREEN: targeted Task 5 tests passed 8/8, lint passed, typecheck passed, Shopify root file validation passed.
Task 6: complete (commit 102e7f2; integrated as b5b38d1). Review package present in task6 worktree.

Wave 2 integration: cherry-picked Task 4, 5, 6 in order. Resolved Task 4 cutoff conflict to the later boundary fix (`expires_at <= cutoff`). `npm run verify` passed on integration: 112 Worker files / 945 tests, then 3 DOM files / 8 tests. `CLOUDFLARE_ENV=production npm run build` passed.

Task 5: review clean (minor future coverage note only).
Task 7: complete (integrated 03439cb); review found GET logout UI regression; fix integrated separately after TDD.
Task 7 review: important GET logout regression fixed in `961cb51`; POST form regression test passes.
Task 8: complete (integrated `9b3bcb9`); full verify passed (118 Worker files/960 tests, 3 DOM files/8 tests); placeholder check fails only for intentional template adoption values.
Task 10: complete (integrated `b9052e2` from `62adc56`); operations/adoption guides and README/AUDIT links added; Wrangler command syntax checked.
Task 9: complete (integrated `13f48f4`); targeted lifecycle/consumer/model tests 63 passed.
Integration follow-up: updated `workers/app.test.ts` to assert the intentional unsupported-topic `ack` outcome (`50821d9`); targeted worker test 3/3 passed. Full verify run started before this test update and reported the stale expectation failure, so a fresh full gate remains required.

Task 11: complete (integrated `18a7db0`, relative-import enforcement fix `96c98cd`; final production scan leaves model imports only in wiring and wiring submodules).

Task 12: complete. Final review found no Critical findings; Important findings were fixed through TDD in `a704970` (hash subscription-refresh shop logs), `1e9302f`/`3d92df2` (dead-letter wiring and queue-consumer parity), and `cbec034`/`3d92df2` (upload cleanup fallback and malformed `Content-Length`). Fresh gates: `npm run verify` passed 122 Worker files / 1001 tests and 3 DOM files / 9 tests; `npm run cf-typegen` passed with no generated diff; `CLOUDFLARE_ENV=production npm run build` passed; placeholder checker reports only the 10 intentional adoption contract issues. Forbidden-pattern scan found no empty catches, suppressions, or skipped tests in production code. Remaining work is app-specific adoption and the pre-existing uncommitted `skills-lock.json` change.
