import {
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { readFile } from "node:fs/promises";

// Hand the Drizzle-generated migrations to workerd so tests can build the
// schema in a real D1 instance via applyD1Migrations().
const migrations = await readD1Migrations(
  path.join(import.meta.dirname, "drizzle"),
);

// The public design tokens, as SOURCE text. app/emails/tokens.test.ts compares
// the email palette against it, so the two cannot drift.
//
// Read here, in Node, rather than with a `?raw` import: Vite's SCSS plugin
// handles `.scss` before `?raw` can take effect, and the import resolves to an
// empty string — which would make every assertion in that test vacuously pass.
const publicTokensScss = await readFile(
  path.join(import.meta.dirname, "app/styles/public/_tokens.scss"),
  "utf8",
);

export default defineConfig({
  // Resolve the `~/*` tsconfig alias (Vite 8 native — same as vite.config.ts).
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      // Tests must NEVER touch remote resources — the pool defaults
      // remoteBindings to true, which would reach real Cloudflare services.
      // Bindings still run for real, locally, under Miniflare.
      remoteBindings: false,
      miniflare: {
        // NO TEST MAY REACH THE PUBLIC INTERNET. A suite that inherits live
        // credentials and quietly talks to a real service can stay green while
        // doing real damage — so the network is closed, not trusted. Local
        // bindings (D1, KV, R2, Queues) still run for real; that is the point
        // of the Workers pool. A blocked-outbound error is this guard WORKING:
        // fix it with a fake at the outermost HTTP boundary, never by opening
        // a hole here.
        outboundService: () =>
          new Response(
            "Outbound network is blocked in tests. Fake this call at the HTTP boundary.",
            { status: 403 },
          ),
        bindings: {
          TEST_MIGRATIONS: JSON.stringify(migrations),
          TEST_PUBLIC_TOKENS_SCSS: publicTokensScss,
          // Keep the suite self-contained: locally these come from .dev.vars,
          // which is gitignored and absent on a CI runner.
          SHOPIFY_API_KEY: "test-api-key",
          SHOPIFY_API_SECRET: "test-api-secret",
          SHOPIFY_APP_URL: "https://example.test",
          // Signs the internal console's session cookie. Injected here so the
          // session layer is TESTABLE: admin-auth.server.ts refuses to run
          // without it (a constant default would make the cookie forgeable), so
          // without this binding every session test would throw instead of
          // exercising the code.
          INTERNAL_SESSION_SECRET: "test-internal-session-secret",
        },
      },
    }),
  ],
  test: {
    // Integration tests against real workerd + D1 are legitimately slower than
    // unit tests, especially on a cold CI runner. Give them headroom so the
    // suite is reliable rather than flaky — without masking a real hang.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    exclude: ["**/node_modules/**", "build/**", "extensions/**"],
  },
});
