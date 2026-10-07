import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { RouterContextProvider, type ActionFunctionArgs } from "react-router";
import { action as mcpAction } from "../mcp";
import { createPersonalAccessToken } from "~/services/mcp/tokens.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { hashPassword } from "~/lib/password";
import { ShopRepo } from "~/models/shops.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const asActionArgs = (request: Request): ActionFunctionArgs => ({
  request,
  params: {},
  url: new URL(request.url),
  pattern: new URL(request.url).pathname,
  context: new RouterContextProvider(),
});

describe("MCP HTTP JSON-RPC Server Integration", () => {
  async function createStaffAndToken() {
    const adminRepo = new AdminUserRepo();
    const pwHash = await hashPassword("Pass12345678!");
    const admin = await adminRepo.create({
      id: "admin-mcp-test",
      email: "staff-mcp@example.com",
      name: "Test Staff",
      passwordHash: pwHash,
      role: "admin",
      now: Date.now(),
    });

    const { rawToken } = await createPersonalAccessToken({
      label: "MCP Test Suite",
      adminUserId: admin.id,
      adminEmail: admin.email,
      scopes: ["mcp:read", "mcp:tickets:write", "mcp:shops:read", "mcp:shops:write"],
    });

    return { admin, rawToken };
  }

  it("returns 401 with WWW-Authenticate header when no Bearer token provided", async () => {
    await inRequest(async () => {
      const req = new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });

      const resp = await mcpAction(asActionArgs(req));
      expect(resp.status).toBe(401);
      expect(resp.headers.get("WWW-Authenticate")).toContain("Bearer");
    });
  });

  it("executes tools/list and tools/call with dev store exclusion verified", async () => {
    await inRequest(async () => {
      const { rawToken } = await createStaffAndToken();

      // Seed 1 real shop and 1 dev shop
      const shopRepo = new ShopRepo();
      const subRepo = new ShopSubscriptionRepo();

      await shopRepo.recordInstall("real-merchant.myshopify.com", Date.now());
      await shopRepo.recordInstall("partner-test-store.myshopify.com", Date.now());
      // Mark dev store
      await shopRepo.setDevStatus("partner-test-store.myshopify.com", true);

      // Seed subscriptions
      await subRepo.upsertObservation("real-merchant.myshopify.com", {
        type: "CREATED",
        status: "ACTIVE",
        subscriptionId: "sub-1",
        planHandle: "growth",
        billingInterval: "EVERY_30_DAYS",
        occurredAt: Date.now(),
        externalId: "sub-1-evt",
        items: [{ itemType: "base", priceAmount: 4900, priceCurrency: "USD" }],
      });

      await subRepo.upsertObservation("partner-test-store.myshopify.com", {
        type: "CREATED",
        status: "ACTIVE",
        subscriptionId: "sub-2",
        planHandle: "enterprise",
        billingInterval: "EVERY_30_DAYS",
        occurredAt: Date.now(),
        externalId: "sub-2-evt",
        items: [{ itemType: "base", priceAmount: 19900, priceCurrency: "USD" }],
      });

      // 1. tools/list call
      const listReq = new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });

      const listResp = await mcpAction(asActionArgs(listReq));
      expect(listResp.status).toBe(200);
      const listJson = (await listResp.json()) as {
        result?: { tools: Array<{ name: string; description: string }> };
      };
      expect(listJson.result?.tools).toBeDefined();
      expect(listJson.result?.tools.length).toBe(17);

      // 2. tools/call get_revenue_and_plans (verify dev store excluded from MRR)
      const callReq = new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "get_revenue_and_plans",
            arguments: { excludeDev: true },
          },
        }),
      });

      const callResp = await mcpAction(asActionArgs(callReq));
      expect(callResp.status).toBe(200);
      const callJson = (await callResp.json()) as {
        result?: { content?: Array<{ type: string; text: string }> };
      };
      expect(callJson.result?.content?.[0]?.text).toBeDefined();

      const contentText = callJson.result?.content?.[0]?.text ?? "{}";
      const parsedRevenue = JSON.parse(contentText) as {
        mrr: Array<{ amount: number }>;
        summary: { paidRealStores: number; devStoresTotal: number };
      };
      // Real MRR should only be $49.00 (from real-merchant), NOT $49 + $199
      expect(parsedRevenue.mrr[0].amount).toBe(4900);
      expect(parsedRevenue.summary.paidRealStores).toBe(1);
      expect(parsedRevenue.summary.devStoresTotal).toBe(1);
    });
  });

  it("allows uploading attachments and creating custom tickets via MCP tools", async () => {
    await inRequest(async () => {
      const { rawToken } = await createStaffAndToken();
      const shop = `mcp-ticket-${Date.now()}.myshopify.com`;

      // 1. tools/call upload_support_attachment
      const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const uploadReq = new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "upload_support_attachment",
            arguments: {
              shop,
              filename: "sample.png",
              contentType: "image/png",
              contentBase64: pngBase64,
            },
          },
        }),
      });

      const uploadResp = await mcpAction(asActionArgs(uploadReq));
      expect(uploadResp.status).toBe(200);
      const uploadJson = (await uploadResp.json()) as {
        result?: { content?: Array<{ type: string; text: string }> };
      };
      const uploadResult = JSON.parse(uploadJson.result?.content?.[0]?.text ?? "{}") as {
        uploadId: string;
        filename: string;
      };
      expect(uploadResult.uploadId).toBeDefined();
      expect(uploadResult.filename).toBe("sample.png");

      // 2. tools/call create_ticket with uploaded attachment
      const createReq = new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "create_ticket",
            arguments: {
              shop,
              subject: "MCP Support Outreach",
              body: "Hello merchant from AI assistant",
              category: "question",
              merchantEmail: "client@example.com",
              uploadIds: [uploadResult.uploadId],
            },
          },
        }),
      });

      const createResp = await mcpAction(asActionArgs(createReq));
      expect(createResp.status).toBe(200);
      const createJson = (await createResp.json()) as {
        result?: { content?: Array<{ type: string; text: string }> };
      };
      const createResult = JSON.parse(createJson.result?.content?.[0]?.text ?? "{}") as {
        success: boolean;
        ticketId: string;
      };
      expect(createResult.success).toBe(true);
      expect(createResult.ticketId).toBeDefined();
    });
  });
});
