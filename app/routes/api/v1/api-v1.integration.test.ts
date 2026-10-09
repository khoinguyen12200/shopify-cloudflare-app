import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { RouterContextProvider, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { loader as healthLoader } from "./health";
import { loader as revenueLoader } from "./metrics/revenue";
import { loader as shopsLoader } from "./shops/index";
import { action as devStatusAction } from "./shops/dev-status";
import { action as ticketsAction } from "./tickets/index";
import { action as replyAction } from "./tickets/reply";
import { action as uploadAction } from "./support/upload";
import { createPersonalAccessToken } from "~/services/mcp/tokens.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { hashPassword } from "~/lib/password";
import { ShopRepo } from "~/models/shops.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { SupportRepo } from "~/models/support.server";
import { testIds, testRandomBytes } from "~/test/fake-runtime";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const asActionArgs = (request: Request): ActionFunctionArgs => ({
  request,
  params: {},
  url: new URL(request.url),
  pattern: new URL(request.url).pathname,
  context: new RouterContextProvider(),
});
const asLoaderArgs = (request: Request): LoaderFunctionArgs => ({
  request,
  params: {},
  url: new URL(request.url),
  pattern: new URL(request.url).pathname,
  context: new RouterContextProvider(),
});

describe("Reusable REST API (/api/v1/*) Integration", () => {
  async function createStaffAndToken(scopes = ["mcp:read", "mcp:shops:write", "mcp:tickets:write"]) {
    const adminRepo = new AdminUserRepo();
    const pwHash = await hashPassword("Pass12345678!", testRandomBytes);
    const admin = await adminRepo.create({
      id: `admin-rest-${Date.now()}`,
      email: `staff-${Date.now()}@example.com`,
      name: "REST Staff",
      passwordHash: pwHash,
      role: "admin",
      now: Date.now(),
    });

    const { rawToken } = await createPersonalAccessToken({
      label: "REST API Suite",
      adminUserId: admin.id,
      adminEmail: admin.email,
      scopes,
    });

    return { admin, rawToken };
  }

  it("enforces authentication and required scopes", async () => {
    await inRequest(async () => {
      // 1. Missing token -> 401
      const unauthReq = new Request("http://localhost/api/v1/health");
      await expect(
        healthLoader(asLoaderArgs(unauthReq)),
      ).rejects.toSatisfy((resp: unknown) => resp instanceof Response && resp.status === 401);

      // 2. Insufficient scope -> 403
      const { rawToken: readOnlyToken } = await createStaffAndToken(["mcp:read"]);
      const writeReq = new Request("http://localhost/api/v1/shops/dev-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${readOnlyToken}`,
        },
        body: JSON.stringify({ shop: "shop.myshopify.com", is_dev_store: true }),
      });

      await expect(
        devStatusAction(asActionArgs(writeReq)),
      ).rejects.toSatisfy((resp: unknown) => resp instanceof Response && resp.status === 403);
    });
  });

  it("returns real MRR excluding dev stores via GET /api/v1/metrics/revenue", async () => {
    await inRequest(async () => {
      const { rawToken } = await createStaffAndToken();

      const shopRepo = new ShopRepo();
      const subRepo = new ShopSubscriptionRepo();

      await shopRepo.recordInstall("production-paid.myshopify.com", Date.now());
      await shopRepo.recordInstall("test-partner.myshopify.com", Date.now());
      await shopRepo.setDevStatus("test-partner.myshopify.com", true);

      await subRepo.upsertObservation("production-paid.myshopify.com", {
        type: "CREATED",
        status: "ACTIVE",
        subscriptionId: "sub-p1",
        planHandle: "growth",
        billingInterval: "EVERY_30_DAYS",
        occurredAt: Date.now(),
        externalId: "sub-p1-evt",
        items: [{ itemType: "base", priceAmount: 4900, priceCurrency: "USD" }],
      });

      await subRepo.upsertObservation("test-partner.myshopify.com", {
        type: "CREATED",
        status: "ACTIVE",
        subscriptionId: "sub-d1",
        planHandle: "enterprise",
        billingInterval: "EVERY_30_DAYS",
        occurredAt: Date.now(),
        externalId: "sub-d1-evt",
        items: [{ itemType: "base", priceAmount: 19900, priceCurrency: "USD" }],
      });

      const req = new Request("http://localhost/api/v1/metrics/revenue?exclude_dev=true", {
        headers: { Authorization: `Bearer ${rawToken}` },
      });

      const resp = await revenueLoader(asLoaderArgs(req));
      expect(resp.status).toBe(200);
      const json = (await resp.json()) as {
        mrr: Array<{ amount: number }>;
        summary: { paidRealStores: number; devStoresTotal: number };
      };

      expect(json.mrr[0].amount).toBe(4900);
      expect(json.summary.paidRealStores).toBe(1);
      expect(json.summary.devStoresTotal).toBe(1);
    });
  });

  it("updates dev status via POST /api/v1/shops/dev-status and lists directory", async () => {
    await inRequest(async () => {
      const { rawToken } = await createStaffAndToken();
      const shopRepo = new ShopRepo();
      await shopRepo.recordInstall("toggle-shop.myshopify.com", Date.now());

      // Update dev status to true
      const postReq = new Request("http://localhost/api/v1/shops/dev-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({ shop: "toggle-shop.myshopify.com", is_dev_store: true }),
      });

      const postResp = await devStatusAction(asActionArgs(postReq));
      expect(postResp.status).toBe(200);

      const updatedShop = await shopRepo.get("toggle-shop.myshopify.com");
      expect(updatedShop?.isDevStore).toBe(true);

      // List shops with type=dev filter
      const listReq = new Request("http://localhost/api/v1/shops?type=dev", {
        headers: { Authorization: `Bearer ${rawToken}` },
      });

      const listResp = await shopsLoader(asLoaderArgs(listReq));
      expect(listResp.status).toBe(200);
      const listJson = (await listResp.json()) as Array<{ shop: string }>;
      expect(listJson.some((s: { shop: string }) => s.shop === "toggle-shop.myshopify.com")).toBe(true);
    });
  });

  it("supports file uploads, ticket creation on behalf of merchant, and replies via REST API", async () => {
    await inRequest(async () => {
      const { rawToken } = await createStaffAndToken(["mcp:read", "mcp:tickets:write"]);
      const shop = `shop-ticket-${Date.now()}.myshopify.com`;

      // 1. Upload attachment via /api/v1/support/upload
      const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
      const uploadReq = new Request("http://localhost/api/v1/support/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          shop,
          filename: "screenshot.png",
          content_type: "image/png",
          content_base64: pngBase64,
        }),
      });

      const uploadResp = await uploadAction(asActionArgs(uploadReq));
      expect(uploadResp.status).toBe(201);
      const uploadJson = (await uploadResp.json()) as {
        upload_id: string;
        filename: string;
        content_type: string;
        size_bytes: number;
      };
      expect(uploadJson.upload_id).toBeDefined();
      expect(uploadJson.filename).toBe("screenshot.png");
      expect(uploadJson.content_type).toBe("image/png");

      // 2. Create custom ticket from staff side via POST /api/v1/tickets
      const createReq = new Request("http://localhost/api/v1/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          shop,
          subject: "Proactive investigation on checkout",
          body: "Hello merchant, we noticed your question and uploaded this screenshot.",
          category: "bug",
          merchant_email: "merchant@alpha.test",
          upload_ids: [uploadJson.upload_id],
        }),
      });

      const createResp = await ticketsAction(asActionArgs(createReq));
      expect(createResp.status).toBe(201);
      const createJson = (await createResp.json()) as {
        ok: boolean;
        value: { id: string; messageId: string; shop: string };
      };
      expect(createJson.ok).toBe(true);
      const ticketId = createJson.value.id;

      // Verify the ticket in DB
      const supportRepo = new SupportRepo(testIds);
      const thread = await supportRepo.findForStaff(ticketId);
      expect(thread).toBeDefined();
      expect(thread?.ticket.lastAuthor).toBe("staff");
      expect(thread?.messages[0]?.author).toBe("staff");
      expect(thread?.attachments.length).toBe(1);
      expect(thread?.attachments[0]?.filename).toBe("screenshot.png");

      // 3. Reply to ticket with inline attachment via POST /api/v1/tickets/reply
      const replyReq = new Request("http://localhost/api/v1/tickets/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${rawToken}`,
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          body: "Here is an additional log file.",
          attachments: [
            {
              filename: "fix.txt",
              contentType: "text/plain",
              contentBase64: btoa("sample log output"),
            },
          ],
        }),
      });

      const replyResp = await replyAction(asActionArgs(replyReq));
      expect(replyResp.status).toBe(200);

      const updatedThread = await supportRepo.findForStaff(ticketId);
      expect(updatedThread?.messages.length).toBe(2);
      expect(updatedThread?.attachments.length).toBe(2);
      expect(updatedThread?.attachments.some((a) => a.filename === "fix.txt")).toBe(true);
    });
  });
});
