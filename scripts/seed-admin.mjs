#!/usr/bin/env node
// Seed a LOCAL-ONLY internal admin so a fresh clone can sign in immediately.
//
//   npm run db:seed
//
// Credentials: admin@localhost / admin123
//
// ══════════════════════════════════════════════════════════════════════════
//  THIS IS A DEVELOPMENT FIXTURE. IT MUST NEVER REACH A REAL DATABASE.
// ══════════════════════════════════════════════════════════════════════════
// `admin123` is 8 characters — deliberately below the 12-character minimum the
// console enforces on passwords a human types. It exists so `npm run dev` works
// with no setup, nothing more.
//
// Three guards keep it local:
//   1. Only ever runs `wrangler d1 execute --local`. The remote flag is not
//      constructible from here.
//   2. Refuses if any argument looks like it targets remote or production.
//   3. Refuses when CI or NODE_ENV=production is set.
//
// Production accounts are created with `npm run admin:create`, which asks for a
// real password and enforces the policy.
import { spawnSync } from "node:child_process";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEED_EMAIL = "admin@localhost";
const SEED_PASSWORD = "admin123";
const SEED_NAME = "Local Admin";
const DATABASE = "app-db";

// Must match app/lib/password.ts exactly, or the hash will not verify.
const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ── Guards ─────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const dangerous = argv.find((a) => /remote|production|prod/i.test(a));
if (dangerous) {
  console.error(
    `Refusing to seed: "${dangerous}" looks like a non-local target.\n` +
      "This seed is a development fixture. Use `npm run admin:create` for real accounts.",
  );
  process.exit(1);
}
if (process.env.CI || process.env.NODE_ENV === "production") {
  console.error(
    "Refusing to seed in CI / production. This is a local development fixture.",
  );
  process.exit(1);
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await webcrypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return ["pbkdf2", "sha256", ITERATIONS, toBase64(salt), toBase64(bits)].join("$");
}

/** Single-quote escaping for SQL string literals. */
const q = (value) => `'${String(value).replace(/'/g, "''")}'`;

const passwordHash = await hashPassword(SEED_PASSWORD);
const now = Date.now();

// ON CONFLICT DO NOTHING: idempotent, and it never overwrites a password the
// developer has since changed.
const sql = `
INSERT INTO admin_users
  (id, email, name, password_hash, role, status, created_at, updated_at, last_login_at)
VALUES
  (${q("seed-local-admin")}, ${q(SEED_EMAIL)}, ${q(SEED_NAME)}, ${q(passwordHash)},
   'owner', 'active', ${now}, ${now}, NULL)
ON CONFLICT(email) DO NOTHING;
`.trim();

const wrangler = join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

const { status } = spawnSync(
  wrangler,
  ["d1", "execute", DATABASE, "--local", "--command", sql],
  { cwd: repoRoot, stdio: ["ignore", "ignore", "inherit"], shell: false },
);

if (status !== 0) {
  console.error(
    "Seed failed. Have the migrations been applied? `npm run db:migrate:local`",
  );
  process.exit(status ?? 1);
}

console.log(
  `Local internal admin ready:\n` +
    `  Login path: /internal/login (use the dev URL shown by Shopify CLI)\n` +
    `  Email:    ${SEED_EMAIL}\n` +
    `  Password: ${SEED_PASSWORD}\n` +
    `\nDEV ONLY — never use these credentials anywhere real.`,
);
