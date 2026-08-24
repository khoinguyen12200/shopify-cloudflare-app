import type { Config } from "@react-router/dev/config";

export default {
  // Shopify embedded apps need SSR for OAuth + App Bridge.
  ssr: true,
  // Ship the full route manifest in the first document instead of lazy-fetching
  // `/__manifest` per navigation — the free trycloudflare tunnel that
  // `shopify app dev` opens can intermittently 530 on that fetch.
  routeDiscovery: { mode: "initial" },
  future: {
    // Required for @cloudflare/vite-plugin to build the client + SSR (workerd)
    // environments together. Without it `react-router build` skips the client
    // build and the server manifest can't be found.
    v8_viteEnvironmentApi: true,
    // Opt into ALL v8 behaviours now: v8-ready, and silences the dev
    // Future-Flag warnings. v8_middleware makes loader/action `context` a
    // RouterContextProvider — workers/app.ts provides one, and app code reads
    // env via getEnv() (AsyncLocalStorage) rather than threading `context`.
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
