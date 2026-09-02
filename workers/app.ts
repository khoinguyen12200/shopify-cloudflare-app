import {
  createRequestHandler,
  createContext,
  RouterContextProvider,
} from "react-router";
import { runWithRequestContext } from "../app/request-context.server";
import { runScheduledSweeps } from "../app/services/scheduled.server";
import { WebhookDeliveryRepo } from "../app/models/webhook-deliveries.server";
import { WebhookScopeObservationRepo } from "../app/models/webhook-scope-observations.server";
import { ShopRepo } from "../app/models/shops.server";
import { KVSessionStorage } from "../app/session-storage.server";
import {
  consumeWebhook,
  isQueuedWebhook,
} from "../app/services/webhook-consumer";
import { formatWebhookLog, writeWebhookLog } from "../app/services/webhook-logging";

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
    await runWithRequestContext(env, () => runScheduledSweeps(Date.now(), env));
  },

  async queue(batch, env) {
    await runWithRequestContext(env, async () => {
      for (const message of batch.messages) {
        if (!isQueuedWebhook(message.body)) {
          console.error(JSON.stringify({ event: "webhook.invalid_queue_message" }));
          message.ack();
          continue;
        }
        const work = message.body;
        try {
          await consumeWebhook({
            deliveries: new WebhookDeliveryRepo(),
            now: Date.now,
            isRedactedShop: async (shop) => (await new ShopRepo().get(shop)) === undefined,
            log: async (delivery, outcome, attempts, latencyMs) => {
              writeWebhookLog(await formatWebhookLog({
                deliveryId: delivery.id, topic: delivery.topic, shop: delivery.shop,
                handler: delivery.topic, outcome, attempts, latencyMs,
              }));
            },
            handlers: {
              "app/uninstalled": async (delivery) => {
                await new ShopRepo().recordUninstall(delivery.shop, Date.now());
                const sessions = await new KVSessionStorage(env.SESSION).findSessionsByShop(delivery.shop);
                await new KVSessionStorage(env.SESSION).deleteSessions(sessions.map((session) => session.id));
              },
              "app/scopes_update": async (delivery) => {
                const storage = new KVSessionStorage(env.SESSION);
                const scopes = await new WebhookScopeObservationRepo().list(delivery.id, delivery.shop);
                await new WebhookScopeObservationRepo().applyScopes(delivery.id, delivery.shop, scopes, Date.now());
                const sessions = await storage.findSessionsByShop(delivery.shop);
                await Promise.all(sessions.map(async (session) => {
                  session.scope = scopes.join(",");
                  await storage.storeSession(session);
                }));
              },
            },
          }, { ...work, attempts: message.attempts });
          message.ack();
        } catch (error) {
          console.error(JSON.stringify({ event: "webhook.consumer_failed", id: work.id, error: error instanceof Error ? error.message : String(error) }));
          message.retry();
        }
      }
    });
  },
} satisfies ExportedHandler<Env>;
