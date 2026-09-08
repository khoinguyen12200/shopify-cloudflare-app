import { describe, expect, it } from "vitest";
import { ShopifyAppIdentityAdapter } from "./shopify-app-identity.server";

const payload = (app: unknown) => new Response(JSON.stringify({ data: { currentAppInstallation: { app } } }));

describe("ShopifyAppIdentityAdapter", () => {
  it("returns the authenticated app identity when it matches configuration", async () => {
    const adapter = new ShopifyAppIdentityAdapter({ graphql: async () => payload({ id: "gid://shopify/App/1", apiKey: "client-key", handle: "my-app" }), expectedApiKey: "client-key", expectedAppId: "gid://shopify/App/1" });
    await expect(adapter.current()).resolves.toEqual({ id: "gid://shopify/App/1", apiKey: "client-key", handle: "my-app" });
  });

  it("preserves the dynamic handle for different authenticated apps", async () => {
    for (const identity of [
      { id: "gid://shopify/App/1", apiKey: "client-one", handle: "app-one" },
      { id: "gid://shopify/App/2", apiKey: "client-two", handle: "app-two" },
    ]) {
      const adapter = new ShopifyAppIdentityAdapter({
        graphql: async () => payload(identity),
        expectedApiKey: identity.apiKey,
        expectedAppId: identity.id,
      });
      await expect(adapter.current()).resolves.toEqual(identity);
    }
  });

  it("fails closed for mismatched API key or app GID", async () => {
    for (const config of [{ expectedApiKey: "other", expectedAppId: "gid://shopify/App/1" }, { expectedApiKey: "client-key", expectedAppId: "gid://shopify/App/2" }]) {
      const adapter = new ShopifyAppIdentityAdapter({ graphql: async () => payload({ id: "gid://shopify/App/1", apiKey: "client-key", handle: "my-app" }), ...config });
      await expect(adapter.current()).rejects.toThrow(/does not match configured app identity/);
    }
  });

  it("rejects GraphQL errors and null handles", async () => {
    const errors = new ShopifyAppIdentityAdapter({ graphql: async () => new Response(JSON.stringify({ errors: [{ message: "denied" }] })), expectedApiKey: null, expectedAppId: null });
    await expect(errors.current()).rejects.toThrow(/GraphQL errors/);
    const missing = new ShopifyAppIdentityAdapter({ graphql: async () => payload({ id: "gid://shopify/App/1", apiKey: "client-key", handle: null }), expectedApiKey: null, expectedAppId: null });
    await expect(missing.current()).rejects.toThrow(/response was invalid/);
  });
});
