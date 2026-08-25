import { err, ok, unwrap, type Result } from "~/lib/result";
import { fromDecimalString, fromMinorUnits, toCurrency, type Money } from "~/money";
import { appSubscriptionUpdatePayloadSchema } from "~/schemas/webhooks";
import type { SubscriptionStatus } from "~/db/schema";

export interface SubscriptionEventInput {
  readonly subscriptionId: string;
  readonly name: string;
  readonly status: SubscriptionStatus;
  readonly planHandle: string | null;
  readonly interval: string | null;
  readonly price: Money;
  readonly cappedAmount: Money | null;
  /** Epoch milliseconds. */
  readonly shopifyCreatedAt: number;
  /** Epoch milliseconds — the dedupe key, paired with subscriptionId. */
  readonly shopifyUpdatedAt: number;
}

export type SubscriptionEventParseError =
  | "invalid_payload"
  | "invalid_price"
  | "invalid_capped_amount"
  | "invalid_date";

/**
 * Turn a raw `app_subscriptions/update` webhook body into what
 * `subscription_events` stores — the one place the payload's decimal strings
 * and dates get parsed, so nothing downstream ever sees an unparsed one.
 */
export function parseSubscriptionUpdatePayload(
  payload: unknown,
): Result<SubscriptionEventInput, SubscriptionEventParseError> {
  const parsed = appSubscriptionUpdatePayloadSchema.safeParse(payload);
  if (!parsed.success) return err("invalid_payload", parsed.error.message);

  const sub = parsed.data.app_subscription;

  const price = fromDecimalString(sub.price, sub.currency);
  if (!price.ok) return err("invalid_price", price.reason);

  let cappedAmount: Money | null = null;
  if (sub.capped_amount !== undefined) {
    const parsedCapped = fromDecimalString(sub.capped_amount, sub.currency);
    if (!parsedCapped.ok) return err("invalid_capped_amount", parsedCapped.reason);
    cappedAmount = parsedCapped.value;
  }

  const shopifyCreatedAt = Date.parse(sub.created_at);
  const shopifyUpdatedAt = Date.parse(sub.updated_at);
  if (Number.isNaN(shopifyCreatedAt) || Number.isNaN(shopifyUpdatedAt)) {
    return err("invalid_date", `created_at="${sub.created_at}" updated_at="${sub.updated_at}"`);
  }

  return ok({
    subscriptionId: sub.admin_graphql_api_id,
    name: sub.name,
    status: sub.status,
    planHandle: sub.plan_handle ?? null,
    interval: sub.interval ?? null,
    price: price.value,
    cappedAmount,
    shopifyCreatedAt,
    shopifyUpdatedAt,
  });
}

/**
 * Rebuild the `Money` a stored row's `priceAmount`/`priceCurrency` columns
 * represent. Safe to `unwrap`: these columns only ever hold what
 * `parseSubscriptionUpdatePayload` already validated on the way in.
 */
export function storedEventPrice(row: {
  priceAmount: number;
  priceCurrency: string;
}): Money {
  return unwrap(fromMinorUnits(row.priceAmount, unwrap(toCurrency(row.priceCurrency))));
}
