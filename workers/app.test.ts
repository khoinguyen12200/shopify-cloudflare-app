import { count, eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import * as schema from "~/db/schema";
import { describe, expect, it } from "vitest";
import worker from "./app";
import { env } from "cloudflare:test";
import { setupTestDatabase } from "~/test/db";

setupTestDatabase();

describe("worker webhook queue", () => {
  it("acks malformed work and retries failed work for DLQ delivery", async () => {
    const actions: string[] = [];
    await worker.queue({ messages: [
      { body: { nope: true }, ack: () => actions.push("ack-invalid"), retry: () => actions.push("retry-invalid"), attempts: 1 },
      { body: { shop: "missing.myshopify.com", id: "missing" }, ack: () => actions.push("ack-missing"), retry: () => actions.push("retry-missing"), attempts: 1 },
    ] } as never, env);

    expect(actions).toEqual(["ack-invalid", "ack-missing"]);
  });

  it("acks unsupported delivery after persisting dead-letter state", async () => {
    await makeDb(env.DB).insert(schema.shops).values({ shop: "worker.myshopify.com", installedAt: 1 }).run();
    await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: "worker-delivery", eventId: "worker-event", topic: "unsupported/topic", apiVersion: "2026-10", shop: "worker.myshopify.com", triggeredAt: 1, receivedAt: 1, payloadHash: "hash" }).run();
    const actions: string[] = [];

    await worker.queue({ messages: [{
      body: { shop: "worker.myshopify.com", id: "worker-delivery" },
      ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 8,
    }] } as never, env);

    const row = await makeDb(env.DB).select({ status: schema.webhookDeliveries.status, attempts: schema.webhookDeliveries.attempts }).from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, "worker-delivery")).get();
    expect(actions).toEqual(["ack"]);
    expect(row).toEqual({ status: "dead_letter", attempts: 1 });
  });

  it("acks queued work for a redacted shop without writing a projection", async () => {
    await makeDb(env.DB).insert(schema.webhookDeliveries).values({ id: "redacted-delivery", eventId: "redacted-event", topic: "app/uninstalled", apiVersion: "2026-10", shop: "redacted.myshopify.com", triggeredAt: 1, receivedAt: 1, payloadHash: "hash" }).run();
    const actions: string[] = [];

    await worker.queue({ messages: [{
      body: { shop: "redacted.myshopify.com", id: "redacted-delivery" },
      ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 1,
    }] } as never, env);

    const rows = await makeDb(env.DB).select({ count: count() }).from(schema.shops).where(eq(schema.shops.shop, "redacted.myshopify.com")).get();
    const delivery = await makeDb(env.DB).select({ status: schema.webhookDeliveries.status }).from(schema.webhookDeliveries).where(eq(schema.webhookDeliveries.id, "redacted-delivery")).get();
    expect(actions).toEqual(["ack"]);
    expect(Number(rows?.count ?? 0)).toBe(0);
    expect(delivery?.status).toBe("received");
  });
});
