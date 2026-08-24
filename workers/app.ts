import {
  createRequestHandler,
  createContext,
  RouterContextProvider,
} from "react-router";
import { runWithRequestContext } from "../app/request-context.server";

/**
 * With `future.v8_middleware`, a loader/action's `context` is a
 * RouterContextProvider. We expose the Cloudflare env + ctx through a typed
 * context key for React-Router-idiomatic access, AND wrap the request in
 * AsyncLocalStorage so server code can read env via `getEnv()` without
 * threading `context` everywhere.
 *
 * Read the key inside a loader with `context.get(cloudflareContext)`.
 */
export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  fetch(request, env, ctx) {
    return runWithRequestContext(env, () => {
      const context = new RouterContextProvider();
      context.set(cloudflareContext, { env, ctx });
      return requestHandler(request, context);
    });
  },

  // Add `scheduled` (wrangler.jsonc `triggers.crons`) and `queue`
  // (`queues.consumers`) handlers here as the app grows. Wrap each in
  // runWithRequestContext(env, …) so getEnv()/getDb() work inside them too —
  // work longer than ~30s belongs on a Queue, not in waitUntil.
} satisfies ExportedHandler<Env>;
