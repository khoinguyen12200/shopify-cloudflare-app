/// <reference types="vite/client" />
/// <reference types="@shopify/app-bridge-types" />

import "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "s-app-nav": HTMLAttributes<HTMLElement>;
      "s-link": AnchorHTMLAttributes<HTMLAnchorElement>;
      "ui-save-bar": HTMLAttributes<HTMLElement> & { discardConfirmation?: boolean };
    }
  }
}

// The Cloudflare `Env` interface is generated into ./worker-configuration.d.ts
// by `npm run cf-typegen` (wrangler types). The tsconfig `include` glob already
// compiles it, so no triple-slash path is needed here.
//
// NEVER hand-write Env — regenerate it after changing wrangler.jsonc.
