# Upgrading

## Upgrading @shopify/shopify-app-react-router 2.x -> 3.x

Verified 2026-10-09 against this template: the full suite (196 files, 1602 tests), typecheck, lint,
`vite build` and a dev-server smoke test all pass with **no source change** beyond `package.json`. The
breaking changes in 3.x only touch surfaces this template does not use. Check your app against the
list below before assuming the same.

### 1. Dependencies (the only mandatory change)

`@shopify/shopify-app-react-router` 3.x depends on `@shopify/shopify-api` ^15 and
`@shopify/shopify-app-session-storage` ^7, and declares `react-router ^7.6.2` as a peer. Keep the three
Shopify packages in step.

```diff
-    "@shopify/shopify-api": "^14.0.0",
-    "@shopify/shopify-app-react-router": "^2.0.0",
-    "@shopify/shopify-app-session-storage": "^6.0.0",
+    "@shopify/shopify-api": "^15.0.1",
+    "@shopify/shopify-app-react-router": "^3.0.2",
+    "@shopify/shopify-app-session-storage": "^7.0.1",
```

```bash
npm install @shopify/shopify-app-react-router@^3.0.2 @shopify/shopify-api@^15.0.1 @shopify/shopify-app-session-storage@^7.0.1
```

Nothing else is required: `@shopify/polaris-types` and `react-router` stay as they are (this template
is on `react-router` 7.18.2, which satisfies the peer). `npm install` may re-sort `package.json`
keys; that is harmless.

Both libraries require **Node >= 22** (already true for react-router 2.0.0). `.nvmrc` here is 24.14.0.
If your `package.json` `engines.node` still admits 20.x, it is wrong for these packages.

### 2. What changed in 3.x, and whether your code is affected

Search your app for each pattern with `rg`. If it does not match, there is nothing to do.

| Change (package) | Affects you if | Before -> after |
|---|---|---|
| Events webhooks: `eventId` and `resourceId` removed from `authenticate.webhook(request)` results (react-router 3.0.0, api 15.0.0) | You adopted the Events preview and call `authenticate.webhook` for it. `rg "resourceId\|eventId" app` on code that reads the library's result | `const { eventId, resourceId } = await authenticate.webhook(request)` -> dedupe on `webhookId`, read the resource GID from `payload`. Classic webhooks keep `eventId` (`X-Shopify-Event-Id`). This template reads that header itself in `app/adapters/shopify-webhook.server.ts`, so it is unaffected |
| `authenticate.admin` only follows `exitIframe` redirects to the app origin or the Shopify admin (3.0.1) | You send merchants to an external URL through the library's exit-iframe path (`auth.exitIframePath`) | `redirect(externalUrl)` through exit-iframe -> `redirect(externalUrl, { target: "_top" })`. A refused destination throws `ShopifyError`. The template has no such call |
| Cookies set by `@shopify/shopify-api` are `HttpOnly` by default; boolean cookie attributes serialise as bare flags (api 15.0.1) | Browser JS reads OAuth/session cookies, or you parse `Set-Cookie` expecting `secure=true` | Read them on the server, or pass `httpOnly: false`. This template runs no OAuth callback and has no such code |
| Debug logs mask credentials (api 14.0.1/15.0.1) | Log parsing depends on token values | None |
| New optional `polarisUrl` on `shopifyApp({...})` and `<AppProvider>` (3.0.x) | You want a Polaris release candidate | Leave unset |

Unchanged in 3.x (verified by diffing 2.0.0 against 3.0.2): the `shopifyApp` options we pass
(`apiKey`, `apiSecretKey`, `apiVersion`, `scopes`, `appUrl`, `authPathPrefix`, `sessionStorage`,
`distribution`, `hooks.afterAuth`, `future.expiringOfflineAccessTokens`, `customShopDomains`), the
`authenticate.admin` / `unauthenticated.admin` contracts, token-exchange and offline-token refresh
(`ensure-offline-token-is-not-expired`, `refresh-token`), the `Session` shape, the `SessionStorage`
interface (so `app/session-storage.server.ts` and its tests are untouched), `boundary`,
`addDocumentResponseHeaders`, `login`, the `@shopify/shopify-api/adapters/cf-worker` import, and the
`ApiVersion` enum (`July26`, `October26`, `Unstable`). `AppProvider` still requires `apiKey`.

### 3. API version: not part of this upgrade

`apiVersion = ApiVersion.July26` in `app/shopify.server.ts` and `api_version = "2026-07"` in
`shopify.app.toml` and `shopify.app.dev.toml` are one decision. Version 3.x offers
`ApiVersion.October26` but does not require it. Change all three together, deliberately, in a separate
commit.

### 4. Verify

```bash
npm install
npm run verify                      # typecheck + lint + full suite
npx vite build                      # production bundle
npm audit --omit=dev
```

Then load `/app` inside a development store once, to exercise token exchange and the offline-token
refresh for real. That path is not covered by any automated test in this repo.
