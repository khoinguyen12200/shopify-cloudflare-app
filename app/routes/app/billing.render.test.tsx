import { describe, it, expect } from "vitest";
import { fromMinorUnits, toCurrency } from "~/money";
import { err, ok, unwrap } from "~/lib/result";
import type { Outcome } from "~/admin/outcome";
import { renderRoute } from "~/test/render-route";
import type { BillingStatus } from "~/billing/subscription-status";
import Billing, {
  parseCurrentAppInstallationHandle,
  shouldRefreshSubscription,
  shouldShowProcessing,
} from "./billing";

describe("billing refresh trigger", () => {
  it("turns a missing Shopify app handle into a controlled 502", () => {
    expect(() => parseCurrentAppInstallationHandle({ data: {} })).toThrowError(
      expect.objectContaining({ status: 502 }),
    );
  });

  it("turns an empty Shopify app handle into a controlled 502", () => {
    expect(() =>
      parseCurrentAppInstallationHandle({
        data: { currentAppInstallation: { app: { handle: "   " } } },
      }),
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it("rejects a padded Shopify app handle without coercing it", () => {
    expect(() =>
      parseCurrentAppInstallationHandle({
        data: { currentAppInstallation: { app: { handle: " pro " } } },
      }),
    ).toThrowError(expect.objectContaining({ status: 502 }));
  });

  it("does not call Shopify on ordinary billing navigation", () => {
    expect(shouldRefreshSubscription("https://example.test/app/billing?shop=one.myshopify.com")).toBe(false);
  });

  it("refreshes after Shopify returns from hosted plan selection", () => {
    expect(shouldRefreshSubscription("https://example.test/app/billing?plan_handle=pro")).toBe(true);
  });

  it("shows processing UI while a hosted-pricing return is being reconciled", () => {
    expect(shouldShowProcessing("https://example.test/app/billing?plan_handle=pro")).toBe(true);
    expect(shouldShowProcessing("https://example.test/app/billing")).toBe(false);
  });
});

const USD = unwrap(toCurrency("USD"));
const price = (minor: number) => unwrap(fromMinorUnits(minor, USD));

const subscribed = (
  over: Partial<Extract<BillingStatus, { kind: "subscribed" }>> = {},
): BillingStatus => ({
  kind: "subscribed",
  name: "TODO:PRO",
  status: "ACTIVE",
  test: false,
  price: price(2999),
  interval: "every_30_days",
  trialEndsAt: null,
  periodEnd: Date.parse("2026-12-01T00:00:00.000Z"),
  ...over,
});

/**
 * The "Your plan" section, which was rebuilt on the repair-ops console's shape.
 *
 * The Polaris elements render as inert tags here, so what is asserted is what
 * the page DECIDED: which plan name, which price line, which action — and
 * particularly the money, where showing a figure the merchant is not being
 * charged is the failure this section's pure helper exists to prevent.
 */
async function render(status: BillingStatus, locale: "en" | "es" = "en", planHandle: string | null = null) {
  return renderBilling(
    { pricingReturn: false, plan: Promise.resolve(ok({ status, planHandle, promo: null })), planLink: Promise.resolve(ok(PLAN_LINK)) },
    "settled",
    locale,
  );
}

const PLAN_LINK = "https://admin.shopify.com/plans";
const FAILED: Outcome<never> = err("failed");

function renderBilling(loaderData: unknown, stage: "pending" | "settled", locale: "en" | "es" = "en") {
  return renderRoute({ path: "/app/billing", Component: Billing, loaderData, stage, locale });
}

describe("the current-plan section", () => {
  it("labels the plan and offers the upgrade on the free plan", async () => {
    const html = await render({ kind: "free" });

    expect(html).toContain("Your plan");
    expect(html).toContain("$0.00/mo");
    expect(html).toContain("Upgrade");
  });

  it("says who manages plans, so leaving the app is not a surprise", async () => {
    const html = await render({ kind: "free" });
    expect(html).toContain("Plans are managed by Shopify");
  });

  it("offers to manage, not upgrade, once subscribed", async () => {
    const html = await render(subscribed());

    expect(html).toContain("Manage plan");
    expect(html).not.toContain(">Upgrade<");
  });

  it("marks the card whose immutable Shopify handle is active", async () => {
    const html = await render(subscribed({ name: "Localized Pro" }), "en", "pro");
    expect(html).toContain("Current plan");
  });

  it("quotes a monthly subscriber a monthly figure", async () => {
    const html = await render(subscribed({ interval: "every_30_days" }));
    expect(html).toContain("$29.99/mo");
  });

  it("quotes an ANNUAL subscriber the annual figure, never a monthly one", async () => {
    // Labelling a yearly charge "/mo" misstates what leaves their account.
    const html = await render(
      subscribed({ interval: "annual", price: price(29900) }),
    );

    expect(html).toContain("$299.00/yr");
    // Scoped to the figure: the plan cards below legitimately say "/month".
    expect(html).not.toContain("$299.00/mo");
  });

  it("shows the figure with NO cadence when Shopify reported no interval", async () => {
    const html = await render(subscribed({ interval: null }));

    expect(html).toContain("$29.99");
    expect(html).not.toContain("$29.99/mo");
    expect(html).not.toContain("$29.99/yr");
  });

  it("shows NO figure at all when the subscription carries no price", async () => {
    // A grandfathered or discounted charge must not be quoted at list price.
    const html = await render(subscribed({ price: null }));

    expect(html).toContain("TODO:PRO");
    expect(html).not.toContain("$29.99");
  });

  it("badges a test charge, so nobody reads it as real money", async () => {
    const html = await render(subscribed({ test: true }));
    expect(html).toContain("Test charge");
  });

  it("shows the subscription status as a badge", async () => {
    const html = await render(subscribed({ status: "PENDING" }));
    expect(html).toContain("Pending approval");
  });

  it("translates the section rather than hardcoding English", async () => {
    const html = await render({ kind: "free" }, "es");

    expect(html).toContain("Tu plan");
    expect(html).not.toContain("Your plan");
    expect(html).not.toContain("Plans are managed by Shopify");
  });
});

const settledPlan = Promise.resolve(ok({ status: { kind: "free" } satisfies BillingStatus, planHandle: null, promo: null }));
const never = new Promise<never>(() => undefined);

describe("streaming the billing page", () => {
  it("renders the frame and heading at once, with a labelled spinner where the plan will be", async () => {
    const html = await renderBilling({ pricingReturn: false, plan: never, planLink: never }, "pending");

    expect(html).toContain('<s-page heading="Billing"');
    expect(html).toContain('accessibilityLabel="Loading your plan"');
    expect(html).toContain('accessibilityLabel="Loading plans"');
    // The catalog keeps its own heading while pending, so only its body is missing.
    expect(html).toContain('heading="Plans"');
    expect(html).not.toContain("Your plan");
    expect(html).not.toContain("Plans are managed by Shopify");
  });

  it("shows a critical banner, never a plausible plan, when the plan failed", async () => {
    const html = await renderBilling({ pricingReturn: false, plan: Promise.resolve(FAILED), planLink: Promise.resolve(ok(PLAN_LINK)) }, "settled");

    expect(html).toContain('tone="critical"');
    expect(html).toContain("We couldn&#x27;t load your plan");
    expect(html).not.toContain("Your plan");
    expect(html).not.toContain("Upgrade");
    // The page frame survives, so navigation stays usable.
    expect(html).toContain('<s-page heading="Billing"');
  });

  it("keeps the plan and says the link is unavailable when only the plan link failed", async () => {
    const html = await renderBilling({ pricingReturn: false, plan: settledPlan, planLink: Promise.resolve(FAILED) }, "settled");

    expect(html).toContain("Your plan");
    expect(html).toContain("The plan link is unavailable right now");
    expect(html).not.toContain(">Upgrade<");
  });

  it("translates the pending and failed copy", async () => {
    const pending = await renderBilling({ pricingReturn: false, plan: never, planLink: never }, "pending", "es");
    expect(pending).toContain('accessibilityLabel="Cargando tu plan"');
    expect(pending).not.toContain("Loading your plan");

    const failed = await renderBilling({ pricingReturn: false, plan: Promise.resolve(FAILED), planLink: Promise.resolve(FAILED) }, "settled", "es");
    expect(failed).toContain("No pudimos cargar tu plan");
  });

  it("goes straight to the processing screen after hosted plan selection, without waiting on any region", async () => {
    const html = await renderBilling({ pricingReturn: true }, "pending");
    expect(html).toContain("s-spinner");
  });
});
