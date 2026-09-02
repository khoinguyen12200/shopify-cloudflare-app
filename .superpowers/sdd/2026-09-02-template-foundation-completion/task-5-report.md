# Task 5 Report

- Added `--temp-root`, `--claude-dir`, and `--codex-dir` destination controls.
- Destination paths reject values outside supplied `--temp-root`.
- Locked installs compare raw `skills-lock.json` bytes after restore and fail on mutation; altered lockfiles are never silently restored.
- Added isolated Node tests covering destination isolation, path validation, and lockfile byte stability.
- `node scripts/install-skills.test.mjs`: 2 passed.
- `npm run test:agent-setup`: 9 passed.
