import { err, ok } from "~/lib/result";
import { shopLog } from "~/observability/shop-log";
import type { Outcome } from "./outcome";

type SettleContext = {
  /** Stable event name, e.g. `admin.billing.plan.failed`. */
  readonly event: string;
  readonly shop: string;
  /** The route the region belongs to, e.g. `app/billing`. */
  readonly route: string;
};

/** Class name and, for a thrown `Response`, its status. Never a message: those can carry customer data. */
function describeFailure(error: unknown): { errorName: string; status: number | null } {
  if (error instanceof Response) return { errorName: "Response", status: error.status };
  return { errorName: error instanceof Error ? error.name : typeof error, status: null };
}

/**
 * Starts a streamed region and converts its failure into a value.
 *
 * Authentication stays AWAITED in the loader; only the region's data goes
 * through here. The returned promise NEVER rejects, which matters twice: React
 * Router sends it to the browser as a pending promise (a rejection there would
 * need an error boundary), and a rejection nobody has subscribed to yet would
 * be an unhandled one. A failure is logged once, with a stable event name and
 * the shop hash, then handed to the component as `{ ok: false }` so it can show
 * an error in that region and keep the rest of the page usable.
 *
 * A region whose value the page cannot be correct without (a plan, an amount)
 * must render its failure; only decoration may fall back to a default.
 */
export async function settle<T>(region: Promise<T>, context: SettleContext): Promise<Outcome<T>> {
  try {
    return ok(await region);
  } catch (error) {
    const { errorName, status } = describeFailure(error);
    await shopLog(context.event, context.shop, { route: context.route, errorName, status });
    return err("failed");
  }
}
