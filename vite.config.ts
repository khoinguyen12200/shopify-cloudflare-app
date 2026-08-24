import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// `shopify app dev` passes the live tunnel URL as SHOPIFY_APP_URL (older CLIs:
// HOST). Compute it into a local — do NOT mutate process.env, since the
// generated types make process.env.SHOPIFY_APP_URL a literal.
const appUrl =
  process.env.SHOPIFY_APP_URL || process.env.HOST || "http://localhost";
const host = new URL(appUrl).hostname;

/**
 * `shopify app dev` injects the tunnel URL + API credentials into THIS Node
 * process. The app itself runs in workerd, which has no `process.env`, so
 * forward those values into the Worker's `vars` through the Cloudflare plugin's
 * `config` hook. Plugin `config` values take precedence over wrangler.jsonc
 * `vars`, so the live tunnel URL and real secret override the local fallbacks.
 *
 * Wired for `command === "serve"` only — never for `vite build` — so a secret
 * can never be baked into production build output. Production secrets are set
 * with `wrangler secret put`.
 */
function shopifyDevVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  if (process.env.SHOPIFY_API_KEY) {
    vars.SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
  }
  if (process.env.SHOPIFY_API_SECRET) {
    vars.SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;
  }
  if (process.env.SCOPES !== undefined) {
    vars.SCOPES = process.env.SCOPES;
  }
  const injectedAppUrl = process.env.SHOPIFY_APP_URL || process.env.HOST;
  if (injectedAppUrl) {
    vars.SHOPIFY_APP_URL = injectedAppUrl;
  }
  return vars;
}

export default defineConfig(({ command }) => ({
  // Vite 8 resolves tsconfig `paths` (the `~/*` alias) natively — this replaces
  // the vite-tsconfig-paths plugin the upstream template used.
  resolve: { tsconfigPaths: true },
  // Only constrain host/port when running behind the Shopify CLI tunnel; plain
  // `npm run dev:local` uses Vite defaults. Do NOT add a custom
  // `server.hmr`/`server.cors` here — it breaks the @cloudflare/vite-plugin dev
  // runner (it fails to load the Worker entry).
  server: {
    ...(host !== "localhost" ? { allowedHosts: [host] } : {}),
    ...(process.env.PORT ? { port: Number(process.env.PORT) } : {}),
  },
  plugins: [
    // Runs the app in the Workers runtime (workerd) during dev, matching
    // production. Bindings are real (D1, KV) via Miniflare.
    cloudflare({
      viteEnvironment: { name: "ssr" },
      ...(command === "serve"
        ? { config: () => ({ vars: shopifyDevVars() }) }
        : {}),
    }),
    // Tailwind only affects CSS that `@import "tailwindcss"` — which is only
    // app/styles/internal/internal.tailwind.css, loaded by the /internal routes.
    // The public SCSS and the Polaris admin are untouched.
    tailwindcss(),
    reactRouter(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
}));
