import { generateSQLiteDrizzleJson, generateSQLiteMigration } from "drizzle-kit/api";
import { fkParent, fkChild } from "./app/test/cleanup-schema.ts";
import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";

// Keep environment validation quiet and deterministic in the test process;
// these values are never used for outbound calls (the worker pool blocks them).
for (const [name, value] of Object.entries({
  SHOPIFY_API_SECRET: "test-api-secret",
  SHOP_CUSTOM_DOMAIN: "example.myshopify.com",
  INTERNAL_SESSION_SECRET: "test-internal-session-secret",
  SHOPIFY_PARTNER_API_TOKEN: "test-partner-token",
  ATTACHMENT_TOKEN_SECRET: "test-attachment-secret",
})) {
  process.env[name] ??= value;
}

// Hand the Drizzle-generated migrations to workerd so tests can build the
// schema in a real D1 instance via applyD1Migrations().
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "drizzle"),
);

const emptyCleanupSchema = await generateSQLiteDrizzleJson({});
const parentCleanupSchema = await generateSQLiteDrizzleJson({ fkParent });
const fullCleanupSchema = await generateSQLiteDrizzleJson({ fkParent, fkChild });
const cleanupMigrations = {
  create: [{ name: "cleanup-fixture-create", queries: await generateSQLiteMigration(emptyCleanupSchema, fullCleanupSchema) }],
  drop: [{ name: "cleanup-fixture-drop", queries: [
    ...await generateSQLiteMigration(fullCleanupSchema, parentCleanupSchema),
    ...await generateSQLiteMigration(parentCleanupSchema, emptyCleanupSchema),
  ] }],
};

const publicTokensScss = await readFile(
  path.join(import.meta.dirname, "app/styles/public/_tokens.scss"),
  "utf8",
);

function collectTests(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTests(full));
    } else if (entry.isFile() && (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx"))) {
      results.push(full);
    }
  }
  return results;
}

// `workers/` holds the Worker entry's own tests (queue routing, cron); leaving
// it out of this list silently excluded them from every run.
const allTestFiles = [...collectTests("app"), ...collectTests("workers")];

const DOM_FILES = [
  "app/components/support/AttachmentPicker.render.test.tsx",
  "app/routes/app/support/use-pending-uploads.test.tsx",
  "app/routes/app/support/dom-outbound-guard.test.ts",
];

const EXPLICIT_WORKERS = [
  "app/outbound-guard.test.ts",
  "app/adapters/shopify-partner.test.ts",
  "app/adapters/shopify-store-credit.test.ts",
  "app/routes/app/_layout.render.test.tsx",
];

const domSet = new Set(DOM_FILES);
const workersFiles: string[] = [];
const domFiles: string[] = [];
const unitFiles: string[] = [];

for (const file of allTestFiles) {
  if (domSet.has(file) || file.includes(".dom.test.")) {
    domFiles.push(file);
  } else if (EXPLICIT_WORKERS.includes(file)) {
    workersFiles.push(file);
  } else {
    const content = readFileSync(file, "utf8");
    if (
      content.includes("cloudflare:test") ||
      content.includes("cloudflare:workers") ||
      content.includes("applyD1Migrations")
    ) {
      workersFiles.push(file);
    } else {
      unitFiles.push(file);
    }
  }
}

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { "~": path.resolve(import.meta.dirname, "app") } },
        test: {
          name: "unit",
          include: unitFiles,
          environment: "node",
        },
      },
      {
        resolve: { alias: { "~": path.resolve(import.meta.dirname, "app") } },
        test: {
          name: "dom",
          include: domFiles,
          environment: "jsdom",
          setupFiles: ["app/test/dom-outbound-guard.setup.ts"],
        },
      },
      {
        resolve: { tsconfigPaths: true },
        plugins: [
          cloudflareTest({
            // A stub entry: see app/test/worker-entry.ts for why not workers/app.ts.
            main: "./app/test/worker-entry.ts",
            wrangler: { configPath: "./wrangler.jsonc" },
            remoteBindings: false,
            miniflare: {
              outboundService: () =>
                new Response(
                  "Outbound network is blocked in tests. Fake this call at the HTTP boundary.",
                  { status: 403 },
                ),
              bindings: {
                TEST_MIGRATIONS: JSON.stringify(migrations),
                TEST_CLEANUP_MIGRATIONS: JSON.stringify(cleanupMigrations),
                TEST_PUBLIC_TOKENS_SCSS: publicTokensScss,
                SHOPIFY_API_KEY: "test-api-key",
                SHOPIFY_API_SECRET: "test-api-secret",
                ATTACHMENT_TOKEN_SECRET: "test-attachment-secret",
                SHOP_CUSTOM_DOMAIN: "example.myshopify.com",
                SHOPIFY_PARTNER_API_TOKEN: "test-partner-token",
                SHOPIFY_APP_URL: "https://example.test",
                INTERNAL_SESSION_SECRET: "test-internal-session-secret",
              },
            },
          }),
        ],
        test: {
          name: "workers",
          // One workerd runtime shared by every file in a worker, instead of a
          // fresh isolate (and a fresh import of the whole dependency graph) per
          // file. That startup was most of the suite's time. The cost is that
          // KV, R2 and in-memory binding state is NOT reset between files, so a
          // test must not depend on another file's leftovers: use unique keys,
          // and reset D1 with setupTestDatabase(). Verified with shuffled file
          // order (see .claude/rules/testing.md).
          isolate: false,
          testTimeout: 60_000,
          hookTimeout: 60_000,
          include: workersFiles,
        },
      },
    ],
  },
});
