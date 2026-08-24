import {
  createRequestHandler,
  createContext,
  RouterContextProvider,
} from "react-router";
import { runWithRequestContext } from "../app/request-context.server";
import { runScheduledSweeps } from "../app/services/scheduled.server";

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

  /**
   * Cron (wrangler.jsonc `triggers.crons`). Wrapped in the request context so
   * getEnv()/getDb() resolve here exactly as they do in `fetch`.
   *
   * Add a `queue` handler the same way when a consumer appears — work longer
   * than ~30s belongs on a Queue, never in waitUntil.
   */
  async scheduled(_controller, env) {
    await runWithRequestContext(env, () => runScheduledSweeps(Date.now()));
  },
} satisfies ExportedHandler<Env>;
