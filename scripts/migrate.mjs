#!/usr/bin/env node
// Apply D1 migrations, retrying transient Cloudflare API errors.
//
//   node scripts/migrate.mjs --local
//   node scripts/migrate.mjs --remote --env production --database app-db-prod
//
// WHY NOT A BARE `wrangler d1 migrations apply`:
// it intermittently fails with a 5xx "internal error" while querying migration
// state. Nothing is actually wrong — but in a deploy chain
// (migrate && build && deploy) that aborts the whole release, and someone has to
// notice and re-run it.
//
// Retrying is SAFE because applying migrations is idempotent: already-applied
// ones are skipped. That is the property that makes a retry correct rather than
// hopeful, and it is why this retries the whole command instead of trying to
// resume.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const MAX_ATTEMPTS = 4;
/** Backoff between attempts. Short: a deploy is waiting on this. */
const BACKOFF_MS = [1_000, 3_000, 8_000];

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function flag(name, fallback) {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return fallback;
  return argv[i].includes("=") ? argv[i].split("=").slice(1).join("=") : argv[i + 1];
}

const database = flag("database", "app-db");
const remote = argv.includes("--remote");
const envName = flag("env");

const args = ["d1", "migrations", "apply", database];
args.push(remote ? "--remote" : "--local");
if (envName) args.push("--env", envName);

const wrangler = join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

function runOnce() {
  return new Promise((resolve) => {
    const child = spawn(wrangler, args, {
      cwd: repoRoot,
      stdio: "inherit",
      shell: false,
    });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const code = await runOnce();
  if (code === 0) process.exit(0);

  if (attempt === MAX_ATTEMPTS) {
    console.error(
      `\nMigrations failed after ${MAX_ATTEMPTS} attempts. This is no longer a ` +
        "transient error — read the output above before retrying.",
    );
    process.exit(code);
  }

  const delay = BACKOFF_MS[attempt - 1] ?? 8_000;
  console.error(
    `\nMigration attempt ${attempt}/${MAX_ATTEMPTS} failed (exit ${code}). ` +
      `Retrying in ${delay / 1000}s — applying migrations is idempotent, so this is safe.`,
  );
  await wait(delay);
}
