#!/usr/bin/env node
/**
 * The release steps executed in Cloudflare Workers Builds.
 *
 * Workers Builds runs exactly two things: the build command, then the deploy
 * command (`npx wrangler deploy`). Nothing in between.
 *
 *   1. D1 migrations: applied BEFORE the worker deploys, so code can never
 *      land ahead of its schema. Runs via scripts/migrate.mjs which retries
 *      transient Cloudflare API 5xx errors. Fails the build on fatal error
 *      so prod keeps serving the old working worker.
 *   2. `shopify app deploy`: pushes app config + extensions. Only runs when
 *      commits actually touched them, and non-fatal so worker deploy continues.
 *
 * Runs ONLY inside the Workers Builds container (WORKERS_CI), so `npm run build`
 * on a laptop is untouched and can never reach the production database.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { touchesShopifyConfig } from "./ci-release/shopify-config-paths.mjs";

if (!process.env.WORKERS_CI) process.exit(0);

const run = (cmd, args, env = process.env) =>
  execFileSync(cmd, args, { stdio: "inherit", env });

// ── 1. D1 migrations (fatal on failure) ─────────────────────────────────────
console.log("▶ applying D1 migrations to production (remote)…");
const migrationEnv = process.env.D1_MIGRATIONS_API_TOKEN
  ? { ...process.env, CLOUDFLARE_API_TOKEN: process.env.D1_MIGRATIONS_API_TOKEN }
  : process.env;

try {
  run(
    "node",
    ["scripts/migrate.mjs", "--remote", "--env", "production", "--database", "app-db-prod"],
    migrationEnv,
  );
  console.log("✓ migrations applied");
} catch (error) {
  console.error("✖ D1 migrations failed — aborting build to prevent code landing ahead of schema.", error);
  process.exit(1);
}

// ── 2. Shopify app config + extensions (best effort) ────────────────────────
if (!process.env.SHOPIFY_APP_AUTOMATION_TOKEN) {
  console.log("• SHOPIFY_APP_AUTOMATION_TOKEN not set — skipping Shopify app deploy.");
} else if (!touchesShopifyConfig()) {
  console.log("• no changes to shopify.app.toml or extensions/ — skipping Shopify app deploy.");
} else {
  const automationToken = process.env.SHOPIFY_APP_AUTOMATION_TOKEN;
  const tokenFingerprint = createHash("sha256")
    .update(automationToken)
    .digest("hex")
    .slice(0, 12);
  console.log(
    `• Shopify automation token: length=${automationToken.length} sha256=${tokenFingerprint}`,
  );
  console.log("▶ deploying Shopify app config + extensions…");
  try {
    run("npx", [
      "--yes",
      "@shopify/cli@latest",
      "app",
      "deploy",
      "--config",
      "shopify.app.toml",
      "--allow-updates",
    ]);
    console.log("✓ Shopify app config deployed");
  } catch (err) {
    // Deliberately not fatal: the worker deploy is what merchants are waiting
    // on, and app config can be pushed again without one.
    console.warn(`⚠ Shopify app deploy failed (worker deploy continues): ${err}`);
  }
}
