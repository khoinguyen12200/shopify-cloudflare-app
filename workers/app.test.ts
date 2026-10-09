import { count, eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./app";
import { shopHasher } from "~/adapters/shop-hasher";
import { RedactedShopRepo } from "~/models/redacted-shops.server";
import { runWithRequestContext } from "~/request-context.server";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";

setupTestDatabase();

describe("worker webhook queue", () => {
  it("acks malformed work and retries failed work for DLQ delivery", async () => {
    const actions: string[] = [];
    await worker.queue({ queue: "shopify-webhooks", messages: [
      { body: { nope: true }, ack: () => actions.push("ack-invalid"), retry: () => actions.push("retry-invalid"), attempts: 1 },
      { body: { shop: "missing.myshopify.com", id: "missing" }, ack: () => actions.push("ack-missing"), retry: () => actions.push("retry-missing"), attempts: 1 },
    ] } as never, env);

    expect(actions).toEqual(["ack-invalid", "ack-missing"]);
  });

  it("acks unsupported delivery after persisting dead-letter state", async () => {
    await makeDb(env.DB).insert(schema.shops).values({ shop: "worker.myshopify.com", installedAt: 1 }).run();
    await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: "worker-delivery", eventId: "worker-event", topic: "unsupported/topic", apiVersion: "2026-10", shop: "worker.myshopify.com", triggeredAt: 1, receivedAt: 1, payloadHash: "hash" }).run();
    const actions: string[] = [];

    await worker.queue({ queue: "shopify-webhooks", messages: [{
      body: { shop: "worker.myshopify.com", id: "worker-delivery" },
      ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 8,
    }] } as never, env);

    const row = await makeDb(env.DB).select({ status: schema.webhookDeliveries.status, attempts: schema.webhookDeliveries.attempts }).from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, "worker-delivery")).get();
    expect(actions).toEqual(["ack"]);
    expect(row).toEqual({ status: "dead_letter", attempts: 1 });
  });

  it("acks queued work for a tombstoned shop without writing a projection, and deletes the delivery it skipped", async () => {
    await runWithRequestContext(env, async () => new RedactedShopRepo().mark(await shopHasher.hash("redacted.myshopify.com"), 1));
    await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: "redacted-delivery", eventId: "redacted-event", topic: "app/uninstalled", apiVersion: "2026-10", shop: "redacted.myshopify.com", triggeredAt: 1, receivedAt: 1, payloadHash: "hash" }).run();
    const actions: string[] = [];

    await worker.queue({ queue: "shopify-webhooks", messages: [{
      body: { shop: "redacted.myshopify.com", id: "redacted-delivery" },
      ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 1,
    }] } as never, env);

    const rows = await makeDb(env.DB).select({ count: count() }).from(schema.shops).where(eq(schema.shops.shop, "redacted.myshopify.com")).get();
    const delivery = await makeDb(env.DB).select({ status: schema.webhookDeliveries.status }).from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, "redacted-delivery")).get();
    expect(actions).toEqual(["ack"]);
    expect(Number(rows?.count ?? 0)).toBe(0);
    // The skipped delivery is deleted, so no row naming the redacted shop lingers.
    expect(delivery).toBeUndefined();
  });
});

describe("worker queue routing", () => {
  const invalidNotification = { event: "retired_event" };

  it.each(["notifications", "notifications-prod"])("routes %s to the notification consumer", async (queue) => {
    const actions: string[] = [];
    await worker.queue({ queue, messages: [
      { body: invalidNotification, ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 1 },
    ] } as never, env);
    expect(actions).toEqual(["ack"]);
  });

  it("keeps real work for an unknown queue instead of acking it", async () => {
    const actions: string[] = [];
    await worker.queue({
      queue: "some-other-queue",
      messages: [{ body: {}, ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 1 }],
      retryAll: (options: unknown) => actions.push(`retryAll:${JSON.stringify(options)}`),
      ackAll: () => actions.push("ackAll"),
    } as never, env);
    expect(actions).toEqual(['retryAll:{"delaySeconds":60}']);
  });
});

describe("worker scheduled handler", () => {
  afterEach(() => vi.restoreAllMocks());

  async function sweepsRunBy(cron: string): Promise<string[]> {
    const sweeps: string[] = [];
    const record = (line: unknown) => {
      const text = String(line);
      const match = /"sweep":"([a-z_]+)"/.exec(text);
      if (match?.[1]) sweeps.push(match[1]);
    };
    vi.spyOn(console, "log").mockImplementation(record);
    vi.spyOn(console, "error").mockImplementation(record);
    await worker.scheduled({ cron, scheduledTime: Date.now(), type: "scheduled", noRetry: () => undefined } as never, env);
    return sweeps;
  }

  it("the hourly production cron runs only the uninstall probe", async () => {
    expect(await sweepsRunBy("0 * * * *")).toEqual(["uninstall_reconciliation"]);
  });

  it("the daily production cron runs the maintenance sweeps and the probe", async () => {
    expect(await sweepsRunBy("30 3 * * *")).toEqual(["password_reset_tokens", "pending_uploads", "partner_history", "uninstall_reconciliation"]);
  });

  it("the local five-minute cron runs everything too", async () => {
    expect(await sweepsRunBy("*/5 * * * *")).toContain("password_reset_tokens");
  });
});
