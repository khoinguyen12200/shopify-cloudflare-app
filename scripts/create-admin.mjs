#!/usr/bin/env node
// Create an internal admin account — the production counterpart to the dev seed.
//
//   npm run admin:create -- --email you@example.com --name "Your Name"
//   npm run admin:create -- --email you@example.com --name "You" --remote
//
// Prompts for the password (never pass it as an argument: arguments land in your
// shell history and in `ps` output). Enforces the same 12-character minimum the
// console does, and hashes with the same PBKDF2 parameters as app/lib/password.ts.
//
// `--remote` targets the production database and is deliberately explicit.
import { spawnSync } from "node:child_process";
import { webcrypto, randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const MIN_PASSWORD_LENGTH = 12;

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

function flag(name) {
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return undefined;
  return argv[i].includes("=") ? argv[i].split("=").slice(1).join("=") : argv[i + 1];
}

const email = (flag("email") ?? "").trim().toLowerCase();
const name = (flag("name") ?? "").trim();
const role = flag("role") === "admin" ? "admin" : "owner";
const remote = argv.includes("--remote");

if (!email || !name) {
  console.error(
    'Usage: npm run admin:create -- --email you@example.com --name "Your Name" [--role admin] [--remote]',
  );
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`"${email}" does not look like an email address.`);
  process.exit(1);
}

/** Read a line without echoing it to the terminal. */
function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout, terminal: true });
    // Suppress echo for the password.
    const onData = () => rl.output.write("");
    rl.output.write(question);
    rl.input.on("data", onData);
    const original = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = () => {};
    rl.question("", (answer) => {
      rl._writeToOutput = original ?? rl._writeToOutput;
      rl.input.off("data", onData);
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

const password = await prompt("Password (min 12 chars, not echoed): ");
if (password.trim().length < MIN_PASSWORD_LENGTH) {
  console.error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  process.exit(1);
}
const again = await prompt("Confirm password: ");
if (password !== again) {
  console.error("The passwords do not match.");
  process.exit(1);
}

const toBase64 = (bytes) => Buffer.from(bytes).toString("base64");

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
const passwordHash = ["pbkdf2", "sha256", ITERATIONS, toBase64(salt), toBase64(bits)].join("$");

const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
const now = Date.now();
const sql = `
INSERT INTO admin_users
  (id, email, name, password_hash, role, status, created_at, updated_at, last_login_at)
VALUES
  (${q(randomUUID())}, ${q(email)}, ${q(name)}, ${q(passwordHash)},
   ${q(role)}, 'active', ${now}, ${now}, NULL);
`.trim();

// Production has its own database name and env, declared in wrangler.jsonc.
const database = remote ? "app-db-prod" : "app-db";
const args = ["d1", "execute", database, "--command", sql];
args.push(remote ? "--remote" : "--local");
if (remote) args.push("--env", "production");

const wrangler = join(
  repoRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

const { status } = spawnSync(wrangler, args, {
  cwd: repoRoot,
  // stdout suppressed so the SQL (which contains the hash) is not echoed.
  stdio: ["inherit", "ignore", "inherit"],
  shell: false,
});

if (status !== 0) {
  console.error(
    "Failed. If the email already exists the unique index rejects it — that is intended.",
  );
  process.exit(status ?? 1);
}

console.log(`Created ${role} "${name}" <${email}> in ${database}${remote ? " (REMOTE)" : " (local)"}.`);
