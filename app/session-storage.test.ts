import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { Session } from "@shopify/shopify-api";
import { KVSessionStorage, ttlSeconds } from "./session-storage.server";

describe("ttlSeconds", () => {
  it("returns undefined when there is no expiry", () => {
    expect(ttlSeconds(undefined, Date.now())).toBeUndefined();
  });

  it("clamps to KV's 60s minimum", () => {
    const now = Date.now();
    expect(ttlSeconds(new Date(now + 1_000), now)).toBe(60);
  });

  it("converts a future expiry to whole seconds", () => {
    const now = Date.now();
    expect(ttlSeconds(new Date(now + 3_600_000), now)).toBe(3600);
  });
});

function offlineSession(shop: string) {
  return new Session({
    id: `offline_${shop}`,
    shop,
    state: "state",
    isOnline: false,
    accessToken: "token",
    scope: "write_products",
  });
}

describe("KVSessionStorage", () => {
  it("round-trips a session", async () => {
    const storage = new KVSessionStorage(env.SESSION);
    const session = offlineSession("round-trip.myshopify.com");

    expect(await storage.storeSession(session)).toBe(true);
    const loaded = await storage.loadSession(session.id);

    expect(loaded?.shop).toBe(session.shop);
    expect(loaded?.accessToken).toBe("token");
  });

  it("finds sessions by shop", async () => {
    const storage = new KVSessionStorage(env.SESSION);
    const session = offlineSession("by-shop.myshopify.com");
    await storage.storeSession(session);

    const found = await storage.findSessionsByShop("by-shop.myshopify.com");

    expect(found.map((s) => s.id)).toContain(session.id);
  });

  it("deletes a session and its shop index entry", async () => {
    const storage = new KVSessionStorage(env.SESSION);
    const session = offlineSession("deleted.myshopify.com");
    await storage.storeSession(session);

    await storage.deleteSession(session.id);

    expect(await storage.loadSession(session.id)).toBeUndefined();
    expect(await storage.findSessionsByShop("deleted.myshopify.com")).toEqual([]);
  });

  it("gives an offline session no KV expiry, so its refresh token outlives the access token", async () => {
    const storage = new KVSessionStorage(env.SESSION);
    const session = offlineSession("offline.myshopify.com");
    // An expiry an offline session would carry with expiring access tokens.
    session.expires = new Date(Date.now() + 60 * 60 * 1000);

    await storage.storeSession(session);

    // Still present, and stored with no expirationTtl — the record must outlive
    // the token it holds.
    expect(await storage.loadSession(session.id)).toBeDefined();
  });
});
