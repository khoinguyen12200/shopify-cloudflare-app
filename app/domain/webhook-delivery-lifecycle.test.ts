import { describe, expect, it } from "vitest";
import { transitionWebhookDelivery, type WebhookDeliveryStatus, type WebhookTransitionEvent } from "./webhook-delivery-lifecycle";

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
