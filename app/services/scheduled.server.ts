import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import { ShopifyPartnerAdapter } from "~/adapters/shopify-partner.server";
import { ShopSyncCheckpointRepo } from "~/models/shop-sync-checkpoints.server";
import { reconcileHistory } from "~/services/reconcile-shopify-history";
import { historyLedger } from "~/wiring.server";

/** Keep spent and expired tokens around briefly, so a replay still reports accurately. */
const TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Everything the cron does, in one place.
 *
 * Each sweep guards its own errors: one failing must never cost the others their
 * tick, and a cron that throws simply does not run the rest.
 */
export async function runScheduledSweeps(now: number, env?: Env): Promise<void> {
  await sweep("password_reset_tokens", async () => {
    const deleted = await new PasswordResetTokenRepo().deleteExpiredBefore(
      now - TOKEN_RETENTION_MS,
    );
    return { deleted };
  });
  if (env) {
    await sweep("partner_history", async () => {
      const result = await reconcileHistory({
        partner: new ShopifyPartnerAdapter({ token: env.SHOPIFY_PARTNER_API_TOKEN || "", fetch }),
        checkpoint: new ShopSyncCheckpointRepo(),
        ledger: historyLedger(),
        clock: { now: () => now },
        appId: env.SHOPIFY_PARTNER_APP_ID || null,
      }, now);
      if (result.status === "failed") throw new Error(`${result.code}: ${result.detail}`);
      return { pages: result.pages, events: result.events };
    });
  }
}

async function sweep(
  name: string,
  run: () => Promise<Record<string, unknown>>,
): Promise<void> {
  try {
    const result = await run();
    console.log(JSON.stringify({ event: "cron.sweep", sweep: name, ...result }));
  } catch (error) {
    // Logged, not rethrown — see above.
    console.error(
      JSON.stringify({
        event: "cron.sweep_failed",
        sweep: name,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
