import { ShopRepo } from "~/models/shops.server";

/**
 * The three mandatory compliance webhook topics. Every app distributed through
 * the Shopify App Store must subscribe to all three and respond to them —
 * whether or not it stores personal data.
 * https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance
 */
export type ComplianceTopic =
  | "CUSTOMERS_DATA_REQUEST"
  | "CUSTOMERS_REDACT"
  | "SHOP_REDACT";

export interface ComplianceContext {
  shop: string;
  payload: Record<string, unknown>;
}

/** What the handler actually did, for the log. Never a silent no-op. */
export interface ComplianceOutcome {
  topic: ComplianceTopic;
  action: string;
  /** Records actually erased or collected. 0 is a valid, honest answer. */
  affected: number;
}

type ComplianceHandler = (ctx: ComplianceContext) => Promise<ComplianceOutcome>;

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  READ THIS BEFORE YOU STORE ANY PERSONAL DATA
 * ══════════════════════════════════════════════════════════════════════════
 * This scaffold stores NO customer personal data — only a `shops` install
 * record. So the `customers/*` handlers have nothing to collect or erase, and
 * they say so explicitly rather than pretending to work.
 *
 * The moment you add a column holding customer data — an email, a name, a
 * phone, an address, an order line — you MUST extend these handlers to really
 * collect and erase it. Shopify rejects apps whose compliance webhooks do not
 * do what they claim, and "it returned 200" is not compliance.
 *
 * You have 30 days from receipt to complete the action.
 */

/**
 * A customer asked the merchant for the data this app holds about them. The
 * payload names the customer and the orders in scope; the app hands the data to
 * the STORE OWNER directly — the webhook response carries no data.
 */
const customersDataRequest: ComplianceHandler = async ({ shop, payload }) => {
  const customer = payload.customer as { id?: number } | undefined;
  const orders = (payload.orders_requested as number[] | undefined) ?? [];

  console.log(
    JSON.stringify({
      event: "compliance.customers_data_request",
      shop,
      customerId: customer?.id ?? null,
      ordersRequested: orders.length,
      collected: 0,
      note: "app stores no customer data",
    }),
  );

  return {
    topic: "CUSTOMERS_DATA_REQUEST",
    action: "no customer data stored; nothing to disclose",
    affected: 0,
  };
};

/** The merchant asked, on a customer's behalf, that their data be deleted. */
const customersRedact: ComplianceHandler = async ({ shop, payload }) => {
  const customer = payload.customer as { id?: number } | undefined;
  const orders = (payload.orders_to_redact as number[] | undefined) ?? [];

  console.log(
    JSON.stringify({
      event: "compliance.customers_redact",
      shop,
      customerId: customer?.id ?? null,
      ordersToRedact: orders.length,
      erased: 0,
      note: "app stores no customer data",
    }),
  );

  return {
    topic: "CUSTOMERS_REDACT",
    action: "no customer data stored; nothing to erase",
    affected: 0,
  };
};

/**
 * Sent 48 hours after the shop uninstalls. Erase everything held for that shop.
 * This one does real work, and it is the pattern to copy: every shop-scoped
 * table gets purged here.
 */
const shopRedact: ComplianceHandler = async ({ shop, payload }) => {
  const shopDomain = (payload.shop_domain as string | undefined) ?? shop;
  const affected = await new ShopRepo().purge(shopDomain);

  console.log(
    JSON.stringify({
      event: "compliance.shop_redact",
      shop: shopDomain,
      erased: affected,
    }),
  );

  return {
    topic: "SHOP_REDACT",
    action: "purged all shop-scoped rows",
    affected,
  };
};

/**
 * Static literal map keyed by the topic union, so TypeScript fails the build if
 * a topic is added without a handler. See @rules/design-patterns.md.
 */
export const complianceHandlers: Record<ComplianceTopic, ComplianceHandler> = {
  CUSTOMERS_DATA_REQUEST: customersDataRequest,
  CUSTOMERS_REDACT: customersRedact,
  SHOP_REDACT: shopRedact,
};

/** True when `topic` is one of the three compliance topics. */
export function isComplianceTopic(topic: string): topic is ComplianceTopic {
  return Object.prototype.hasOwnProperty.call(complianceHandlers, topic);
}

/** Dispatch one compliance webhook. Unknown topics are reported, never thrown. */
export async function handleCompliance(
  topic: string,
  ctx: ComplianceContext,
): Promise<ComplianceOutcome | null> {
  if (!isComplianceTopic(topic)) {
    // Stored data outlives code, and Shopify can add topics. Degrade
    // predictably instead of crashing the endpoint.
    console.log(
      JSON.stringify({
        event: "compliance.unknown_topic",
        shop: ctx.shop,
        topic,
      }),
    );
    return null;
  }
  return complianceHandlers[topic](ctx);
}
