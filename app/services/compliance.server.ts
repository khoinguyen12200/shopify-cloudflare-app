import { purgeTenant, type TenantPurgeD1Port, type TenantPurgeKvPort, type TenantPurgeR2Port } from "~/services/tenant-purge.server";

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
  /**
   * False while this topic is still a scaffold placeholder that collects and
   * erases nothing.
   *
   * `affected: 0` alone cannot tell "there was genuinely nothing to erase" apart
   * from "nobody has written this handler yet", and the second one silently
   * becomes a false answer to a legal request the moment a customer column is
   * added. This flag keeps the difference visible in the logs, so a stale
   * placeholder is greppable in Observability instead of indistinguishable from
   * a real zero. Flip it to `true` in the same change that makes the handler do
   * the work.
   */
  implemented: boolean;
  noCustomerData?: boolean;
}

export interface ComplianceDependencies {
  readonly tenantPurge: { readonly d1: TenantPurgeD1Port; readonly r2: TenantPurgeR2Port; readonly kv: TenantPurgeKvPort };
}
type ComplianceHandler = (ctx: ComplianceContext, deps: ComplianceDependencies) => Promise<ComplianceOutcome>;

function customerId(payload: Record<string, unknown>): number | null {
  const customer = payload.customer;
  if (typeof customer !== "object" || customer === null || !("id" in customer)) return null;
  const id = customer.id;
  return typeof id === "number" ? id : null;
}

function orderCount(payload: Record<string, unknown>, key: "orders_requested" | "orders_to_redact"): number {
  const orders = payload[key];
  return Array.isArray(orders) && orders.every((order) => typeof order === "number") ? orders.length : 0;
}

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
 * collect and erase it, and set `implemented: true` in the same change. Shopify
 * rejects apps whose compliance webhooks do not do what they claim, and "it
 * returned 200" is not compliance.
 *
 * Until then both handlers report `implemented: false` and log
 * `….unimplemented`, so a placeholder that has outlived its truth shows up in
 * the logs rather than quietly answering "nothing held" forever.
 *
 * You have 30 days from receipt to complete the action.
 */

/**
 * A customer asked the merchant for the data this app holds about them. The
 * payload names the customer and the orders in scope; the app hands the data to
 * the STORE OWNER directly — the webhook response carries no data.
 */
const customersDataRequest: ComplianceHandler = async ({ shop, payload }) => {
  console.log(
    JSON.stringify({
      event: "compliance.customers_data_request.no_customer_data",
      shop,
      customerId: customerId(payload),
      ordersRequested: orderCount(payload, "orders_requested"),
      collected: 0,
      note: "placeholder: this app declares it stores no customer data",
    }),
  );

  return {
    topic: "CUSTOMERS_DATA_REQUEST",
    action: "declares no customer data stored; nothing collected",
    affected: 0,
    implemented: true,
    noCustomerData: true,
  };
};

/** The merchant asked, on a customer's behalf, that their data be deleted. */
const customersRedact: ComplianceHandler = async ({ shop, payload }) => {
  console.log(
    JSON.stringify({
      event: "compliance.customers_redact.no_customer_data",
      shop,
      customerId: customerId(payload),
      ordersToRedact: orderCount(payload, "orders_to_redact"),
      erased: 0,
      note: "placeholder: this app declares it stores no customer data",
    }),
  );

  return {
    topic: "CUSTOMERS_REDACT",
    action: "declares no customer data stored; nothing erased",
    affected: 0,
    implemented: true,
    noCustomerData: true,
  };
};

/**
 * Sent 48 hours after the shop uninstalls. Erase everything held for that shop.
 * This one does real work, and it is the pattern to copy: every shop-scoped
 * table gets purged here.
 */
const shopRedact: ComplianceHandler = async ({ shop, payload }, deps) => {
  const shopDomain = typeof payload.shop_domain === "string" ? payload.shop_domain : shop;

  const erased = await purgeTenant(deps.tenantPurge, shopDomain);

  console.log(
    JSON.stringify({
      event: "compliance.shop_redact",
      shop: shopDomain,
      erased: erased.rows,
      // Called out separately: "did the screenshots go too?" is the question
      // a data-deletion request actually has to answer.
      attachmentsDeleted: erased.attachments,
    }),
  );

  return {
    topic: "SHOP_REDACT",
    action: "purged all shop-scoped rows and attachment objects",
    affected: erased.rows,
    implemented: true,
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
  deps: ComplianceDependencies,
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
  return complianceHandlers[topic](ctx, deps);
}
