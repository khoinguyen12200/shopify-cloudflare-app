#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const installer = path.join(repoRoot, "scripts/install-skills.mjs");
const result = spawnSync(
  process.execPath,
  [installer, "--wait", "--locked", "--agent", "claude-code,codex"],
  { cwd: repoRoot, stdio: "inherit" },
);

process.exit(result.status ?? 1);
