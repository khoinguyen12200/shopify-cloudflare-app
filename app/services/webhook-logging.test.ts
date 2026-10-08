import { describe, expect, it, vi } from "vitest";
import { formatWebhookLog, webhookLogLevel, withWebhookFailureLog } from "./webhook-logging";

describe("webhook logs", () => {
  it("contains transport fields and never raw shop or payload data", async () => {
    const log = await formatWebhookLog({
      deliveryId: "delivery-1", topic: "app/uninstalled", shop: "secret.myshopify.com",
      handler: "app/uninstalled", outcome: "processed", attempts: 2, latencyMs: 17,
    });

    expect(log).toMatchObject({
      event: "webhook.process",
      deliveryId: "delivery-1", topic: "app/uninstalled", handler: "app/uninstalled",
      outcome: "processed", attempts: 2, latencyMs: 17,
    });
    expect(log.shopHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(log)).not.toContain("secret.myshopify.com");
    expect(JSON.stringify(log)).not.toContain("payload");
  });
});

const request = () => new Request("https://app.test/webhooks/app/uninstalled", {
  method: "POST",
  headers: { "x-shopify-shop-domain": "secret-shop.myshopify.com", "x-shopify-topic": "app/uninstalled" },
});

describe("withWebhookFailureLog", () => {
  it("passes a result through untouched", async () => {
    await expect(withWebhookFailureLog(request(), async () => "ok")).resolves.toBe("ok");
  });

  it("passes a thrown Response (bad HMAC 401) through without logging it as a failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const denied = new Response("Unauthorized", { status: 401 });
    await expect(withWebhookFailureLog(request(), async () => { throw denied; })).rejects.toBe(denied);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("logs an unexpected failure with the topic and shop hash, then rethrows the original error", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((line: string) => { logged.push(line); });
    const failure = new Error("D1 unavailable");
    await expect(withWebhookFailureLog(request(), async () => { throw failure; })).rejects.toBe(failure);
    spy.mockRestore();
    const entry: unknown = JSON.parse(logged[0] ?? "{}");
    expect(entry).toMatchObject({ event: "webhook.entry_failed", topic: "app/uninstalled", errorName: "Error", error: "D1 unavailable" });
    expect(logged[0]).not.toContain("secret-shop");
    expect(logged[0]).toMatch(/"shopHash":"[0-9a-f]{64}"/);
  });
});

describe("webhookLogLevel", () => {
  it.each(["processed", "duplicate", "discarded", "unsupported"])("treats %s as routine", (outcome) => {
    expect(webhookLogLevel(outcome)).toBe("log");
  });
  it.each(["failed", "invalid", "unavailable", "anything-new"])("treats %s as an error, so an unknown outcome is never hidden", (outcome) => {
    expect(webhookLogLevel(outcome)).toBe("error");
  });
});
