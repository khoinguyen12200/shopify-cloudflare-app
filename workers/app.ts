import {
  createRequestHandler,
  createContext,
  RouterContextProvider,
} from "react-router";
import { runWithRequestContext } from "../app/request-context.server";
import { runScheduledSweeps } from "../app/services/scheduled.server";
import { scheduledDependencies, webhookConsumer } from "../app/wiring.server";
import { consumeWebhook } from "../app/services/webhook-consumer";
import { handleWebhookQueueBatch } from "../app/services/webhook-queue";

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

  /** Cron work shares the request context used by HTTP routes. */
  async scheduled(_controller, env) {
    await runWithRequestContext(env, () => runScheduledSweeps(Date.now(), scheduledDependencies()));
  },

  async queue(batch, env) {
    await runWithRequestContext(env, async () => {
      await handleWebhookQueueBatch(batch, {
        consume: async (work) => {
          // Queue attempts count completed retries; the consumer counts deliveries.
          return consumeWebhook(webhookConsumer(), { ...work, attempts: (work.attempts ?? 0) + 1 });
        },
        log: async (entry) => {
          const digest = entry.shop ? await crypto.subtle.digest("SHA-256", new TextEncoder().encode(entry.shop)) : undefined;
          const shopHash = digest ? `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}` : undefined;
          console.error(JSON.stringify({
            id: entry.id,
            shop: shopHash,
            topic: entry.topic,
            handler: entry.handler,
            outcome: entry.outcome,
            attempts: entry.attempts,
            latencyMs: entry.latencyMs,
          }));
        },
      });
    });
  },
} satisfies ExportedHandler<Env>;
