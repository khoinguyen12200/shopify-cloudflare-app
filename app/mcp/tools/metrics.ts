import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getAiSpendAndUsage,
  getChurnAndRetention,
  getRevenueAndPlans,
  getSystemHealth,
} from "~/services/internal-admin/ops.server";
import { mcpRead, READ_ONLY, type McpActorContext } from "../helpers";

function registerGetRevenueAndPlans(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "get_revenue_and_plans",
    {
      title: "Get Real MRR and Plan Distribution",
      description:
        "Calculates true Monthly Recurring Revenue (MRR) grouped by currency, counts real stores on each plan, and isolates development/partner test stores.",
      inputSchema: {
        excludeDev: z.boolean().optional().describe("Exclude development stores from real MRR (default: true)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("get_revenue_and_plans", "mcp:read", ctx, async (args) =>
      getRevenueAndPlans({ excludeDev: args.excludeDev ?? true }),
    ),
  );
}

function registerGetChurnAndRetention(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "get_churn_and_retention",
    {
      title: "Get Churn & Retention Analytics",
      description:
        "Analyzes merchant churn rate, uninstalls, net growth, and upcoming scheduled cancellations over the last N days.",
      inputSchema: {
        periodDays: z.number().int().min(1).max(365).optional().describe("Lookback window in days (default: 30)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("get_churn_and_retention", "mcp:read", ctx, async (args) =>
      getChurnAndRetention({ periodDays: args.periodDays ?? 30 }),
    ),
  );
}

function registerGetSystemHealth(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "get_system_health",
    {
      title: "Get System Vitals & Health",
      description:
        "Overview of system vitals: webhook failure counts, dead-letter queues, active stores count, and open support tickets.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    mcpRead("get_system_health", "mcp:read", ctx, async () => getSystemHealth()),
  );
}

function registerGetAiSpendAndUsage(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "get_ai_spend_and_usage",
    {
      title: "Get Internal Workers AI Telemetry",
      description:
        "Reports token usage, drafting call counts, latency, and costs for the app's internal Workers AI models.",
      inputSchema: {
        sinceDays: z.number().int().min(1).max(90).optional().describe("Lookback window in days (default: 30)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("get_ai_spend_and_usage", "mcp:read", ctx, async (args) =>
      getAiSpendAndUsage({ sinceDays: args.sinceDays ?? 30 }),
    ),
  );
}

export function registerMetricsTools(server: McpServer, ctx: McpActorContext) {
  registerGetRevenueAndPlans(server, ctx);
  registerGetChurnAndRetention(server, ctx);
  registerGetSystemHealth(server, ctx);
  registerGetAiSpendAndUsage(server, ctx);
}
