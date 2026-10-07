import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getShopDossier,
  getShopWebhookStatus,
  listNewStores,
  listShopsDirectory,
  listWebhookFailures,
  setShopDevStatus,
} from "~/services/internal-admin/ops.server";
import { mcpMutation, mcpRead, MUTATION, READ_ONLY, type McpActorContext } from "../helpers";

export function registerShopTools(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "list_new_stores",
    {
      title: "List Newly Installed Stores",
      description:
        "Lists stores that installed the app in the last N hours with domain, install timestamp, initial plan, and dev store flag.",
      inputSchema: {
        sinceHours: z.number().int().min(1).max(720).optional().describe("Lookback window in hours (default: 24)"),
        type: z.enum(["real", "dev", "all"]).optional().describe("Filter by real, dev, or all stores (default: all)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("list_new_stores", "mcp:shops:read", ctx, async (args) =>
      listNewStores({ sinceHours: args.sinceHours ?? 24, type: args.type ?? "all" }),
    ),
  );

  server.registerTool(
    "list_shops",
    {
      title: "List Stores Directory",
      description:
        "List all registered stores with their install status, active subscription plan, and dev store status.",
      inputSchema: {
        filter: z.enum(["all", "active", "uninstalled"]).optional().describe("Filter by lifecycle status"),
        type: z.enum(["all", "real", "dev"]).optional().describe("Filter by real or dev stores"),
        plan: z.string().optional().describe("Filter by plan name (e.g. Free, Growth, Pro)"),
        limit: z.number().int().min(1).max(200).optional().describe("Maximum stores to return (default: 50)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("list_shops", "mcp:shops:read", ctx, async (args) =>
      listShopsDirectory({
        filter: args.filter ?? "all",
        type: args.type ?? "all",
        plan: args.plan,
        limit: args.limit ?? 50,
      }),
    ),
  );

  server.registerTool(
    "get_shop_dossier",
    {
      title: "Get Complete Shop Dossier",
      description:
        "Comprehensive 360-degree merchant snapshot: installation status, active subscription, pricing, support tickets history, and dev flag.",
      inputSchema: {
        shop: z.string().min(1).describe("Shop domain (e.g. 'mystore.myshopify.com')"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("get_shop_dossier", "mcp:shops:read", ctx, async (args) => {
      const dossier = await getShopDossier(args.shop);
      if (!dossier) throw new Error(`Shop '${args.shop}' not found`);
      return dossier;
    }),
  );

  server.registerTool(
    "set_shop_dev_status",
    {
      title: "Set Development Store Status",
      description:
        "Tag or untag a store as a development/test store. Dev stores are excluded from real MRR and production counts.",
      inputSchema: {
        shop: z.string().min(1).describe("Shop domain (e.g. 'mystore.myshopify.com')"),
        isDevStore: z.boolean().describe("Whether this store is a development/test store"),
      },
      annotations: MUTATION,
    },
    mcpMutation("set_shop_dev_status", "mcp:shops:write", ctx, async (args) => {
      const success = await setShopDevStatus(args.shop, args.isDevStore);
      if (!success) throw new Error(`Shop '${args.shop}' not found`);
      return { success: true, shop: args.shop, isDevStore: args.isDevStore };
    }),
  );

  server.registerTool(
    "get_shop_webhook_status",
    {
      title: "Check Shop Webhook & Scope Status",
      description:
        "Inspects last webhook delivery time and currently granted Shopify API scopes for a specific store.",
      inputSchema: {
        shop: z.string().min(1).describe("Shop domain (e.g. 'mystore.myshopify.com')"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("get_shop_webhook_status", "mcp:shops:read", ctx, async (args) => {
      const status = await getShopWebhookStatus(args.shop);
      if (!status) throw new Error(`Shop '${args.shop}' not found`);
      return status;
    }),
  );

  server.registerTool(
    "list_webhook_failures",
    {
      title: "List Failed Shopify Webhooks",
      description:
        "Inspect failed or dead-lettered webhooks with failure codes, details, and attempt counts.",
      inputSchema: {
        shop: z.string().optional().describe("Filter by specific shop domain"),
        status: z.enum(["failed", "dead_letter"]).optional().describe("Filter by status"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum failures to return (default: 20)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("list_webhook_failures", "mcp:read", ctx, async (args) =>
      listWebhookFailures({
        shop: args.shop,
        status: args.status,
        limit: args.limit ?? 20,
      }),
    ),
  );
}
