// Test-only bindings.
//
// @cloudflare/vitest-pool-workers types `env` from "cloudflare:test" as
// `Cloudflare.Env` — the open interface that `wrangler types` generates into
// worker-configuration.d.ts — so extra bindings injected by vitest.config.ts
// are declared by augmenting that namespace. (The older `ProvidedEnv`
// augmentation is gone as of pool-workers 0.22.)
declare namespace Cloudflare {
  interface Env {
    /** The ./drizzle migrations, serialized by vitest.config.ts. */
    TEST_MIGRATIONS: string;
    /** app/styles/public/_tokens.scss as source text — see emails/tokens.test.ts. */
    TEST_PUBLIC_TOKENS_SCSS: string;
  }
}
