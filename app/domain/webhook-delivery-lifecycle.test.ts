import { describe, expect, it } from "vitest";
import { decideShopGate, deferralDelaySeconds, isWebhookTopic, topicRequiresShopRecord, transitionWebhookDelivery, type WebhookDeliveryStatus, type WebhookTransitionEvent } from "./webhook-delivery-lifecycle";

describe("webhook delivery lifecycle", () => {
  const legal: readonly [WebhookDeliveryStatus, WebhookTransitionEvent, WebhookDeliveryStatus][] = [
    ["received", { type: "queue" }, "queued"],
    ["received", { type: "claim", now: 100, leaseMs: 50 }, "processing"],
    ["queued", { type: "claim", now: 100, leaseMs: 50 }, "processing"],
    ["processing", { type: "claim", now: 150, leaseMs: 50 }, "processing"],
    ["processing", { type: "complete", now: 200 }, "processed"],
    ["processing", { type: "fail", now: 200 }, "failed"],
    ["failed", { type: "claim", now: 100, leaseMs: 50 }, "processing"],
    ["failed", { type: "dead_letter", now: 200 }, "dead_letter"],
  ];

  it.each(legal)("transitions %s on %s", (status, event, to) => {
    expect(transitionWebhookDelivery({ status, processingStartedAt: status === "processing" ? 100 : null }, event))
      .toEqual({ ok: true, value: { from: status, to } });
  });

  it("rejects an active processing lease", () => {
    expect(transitionWebhookDelivery({ status: "processing", processingStartedAt: 100 }, { type: "claim", now: 149, leaseMs: 50 }))
      .toEqual({ ok: false, reason: "lease_active" });
  });

  it("rejects a processing state without a lease timestamp", () => {
    expect(transitionWebhookDelivery({ status: "processing", processingStartedAt: null }, { type: "claim", now: 150, leaseMs: 50 }))
      .toEqual({ ok: false, reason: "illegal_transition" });
  });

  const eventTypes: readonly WebhookTransitionEvent["type"][] = ["queue", "claim", "complete", "fail", "dead_letter"];
  const legalPairs = new Set(legal.map(([status, event]) => `${status}:${event.type}`));
  const statuses: readonly WebhookDeliveryStatus[] = ["received", "queued", "processing", "processed", "failed", "dead_letter"];
  const illegal = statuses.flatMap((status) => eventTypes.filter((type) => !legalPairs.has(`${status}:${type}`)).map((type) => ({ status, type })));

  it.each(illegal)("rejects illegal $status -> $type transitions", ({ status, type }) => {
    const event: WebhookTransitionEvent = type === "claim" ? { type, now: 100, leaseMs: 50 } : { type, now: 100 };
    expect(transitionWebhookDelivery({ status, processingStartedAt: status === "processing" ? 100 : null }, event))
      .toEqual({ ok: false, reason: "illegal_transition" });
  });

  it("rejects unknown stored states", () => {
    expect(transitionWebhookDelivery({ status: "retired", processingStartedAt: null }, { type: "claim", now: 1, leaseMs: 1 }))
      .toEqual({ ok: false, reason: "illegal_transition" });
  });
});

describe("webhook topics", () => {
  const topics = ["app/uninstalled", "app/scopes_update", "customers/data_request", "customers/redact", "shop/redact"] as const;

  it.each(topics)("recognises %s", (topic) => {
    expect(isWebhookTopic(topic)).toBe(true);
  });

  it("rejects unknown, retired, differently-cased and inherited-property topics", () => {
    for (const topic of ["orders/create", "", "SHOP_REDACT", "shop/Redact", "toString", "__proto__", "constructor"]) {
      expect(isWebhookTopic(topic)).toBe(false);
    }
  });

  it("lets only the compliance topics run when the shop record is gone", () => {
    expect(topics.filter((topic) => !topicRequiresShopRecord(topic))).toEqual(["customers/data_request", "customers/redact", "shop/redact"]);
  });
});

describe("decideShopGate", () => {
  const base = { tombstoned: false, hasShopRecord: false, finalAttempt: false };

  it.each(["customers/data_request", "customers/redact", "shop/redact"])("%s always runs, tombstoned or not", (topic) => {
    for (const tombstoned of [true, false]) for (const hasShopRecord of [true, false]) for (const finalAttempt of [true, false]) {
      expect(decideShopGate({ topic, tombstoned, hasShopRecord, finalAttempt })).toBe("run");
    }
  });

  it.each(["app/uninstalled", "app/scopes_update", "orders/create"])("%s for a tombstoned shop is discarded, whatever else is true", (topic) => {
    for (const hasShopRecord of [true, false]) for (const finalAttempt of [true, false]) {
      expect(decideShopGate({ topic, tombstoned: true, hasShopRecord, finalAttempt })).toBe("discard_redacted");
    }
  });

  it.each(["app/uninstalled", "app/scopes_update"])("%s for a known shop runs", (topic) => {
    expect(decideShopGate({ ...base, topic, hasShopRecord: true })).toBe("run");
  });

  it("an uninstall for an unknown shop runs as a flagged no-op, on any attempt", () => {
    expect(decideShopGate({ ...base, topic: "app/uninstalled" })).toBe("run_unknown_shop");
    expect(decideShopGate({ ...base, topic: "app/uninstalled", finalAttempt: true })).toBe("run_unknown_shop");
  });

  it("a scopes update for an unknown shop is deferred until the final attempt, then runs flagged", () => {
    expect(decideShopGate({ ...base, topic: "app/scopes_update" })).toBe("defer_unknown_shop");
    expect(decideShopGate({ ...base, topic: "app/scopes_update", finalAttempt: true })).toBe("run_unknown_shop");
  });

  it("an unrecognised topic that is not tombstoned runs, so it reaches the retire-unsupported path", () => {
    expect(decideShopGate({ ...base, topic: "orders/create" })).toBe("run");
    expect(decideShopGate({ ...base, topic: "toString" })).toBe("run");
  });
});

describe("deferralDelaySeconds", () => {
  it("doubles from a minute and caps at an hour", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 100].map(deferralDelaySeconds)).toEqual([60, 120, 240, 480, 960, 1920, 3600, 3600, 3600, 3600]);
  });

  it("treats a missing or zero attempt count as the first", () => {
    expect(deferralDelaySeconds(0)).toBe(60);
    expect(deferralDelaySeconds(-3)).toBe(60);
  });
});
