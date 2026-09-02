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

  it("retries failed delivery and persists dead-letter state on final attempt", async () => {
    await env.DB.prepare("INSERT INTO shops (shop, installed_at) VALUES (?, ?)").bind("worker.myshopify.com", 1).run();
    await env.DB.prepare("INSERT INTO webhook_deliveries (id, event_id, topic, api_version, shop, triggered_at, received_at, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("worker-delivery", "worker-event", "unsupported/topic", "2026-10", "worker.myshopify.com", 1, 1, "hash").run();
    const actions: string[] = [];

    await worker.queue({ messages: [{
      body: { shop: "worker.myshopify.com", id: "worker-delivery" },
      ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 8,
    }] } as never, env);

    const row = await env.DB.prepare("SELECT status, attempts FROM webhook_deliveries WHERE id = ?")
      .bind("worker-delivery").first<{ status: string; attempts: number }>();
    expect(actions).toEqual(["retry"]);
    expect(row).toEqual({ status: "dead_letter", attempts: 1 });
  });

  it("acks queued work for a redacted shop without writing a projection", async () => {
    await env.DB.prepare("INSERT INTO webhook_deliveries (id, event_id, topic, api_version, shop, triggered_at, received_at, payload_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind("redacted-delivery", "redacted-event", "app/uninstalled", "2026-10", "redacted.myshopify.com", 1, 1, "hash").run();
    const actions: string[] = [];

    await worker.queue({ messages: [{
      body: { shop: "redacted.myshopify.com", id: "redacted-delivery" },
      ack: () => actions.push("ack"), retry: () => actions.push("retry"), attempts: 1,
    }] } as never, env);

    const rows = await env.DB.prepare("SELECT count(*) AS count FROM shops WHERE shop = ?")
      .bind("redacted.myshopify.com").first<{ count: number }>();
    const delivery = await env.DB.prepare("SELECT status FROM webhook_deliveries WHERE id = ?")
      .bind("redacted-delivery").first<{ status: string }>();
    expect(actions).toEqual(["ack"]);
    expect(Number(rows?.count ?? 0)).toBe(0);
    expect(delivery?.status).toBe("received");
  });
});
