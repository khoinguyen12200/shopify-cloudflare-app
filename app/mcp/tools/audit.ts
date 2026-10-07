import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { listRecentAuditLogs } from "~/services/mcp/audit.server";
import { mcpRead, READ_ONLY, type McpActorContext } from "../helpers";

export function registerAuditTools(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "list_audit_logs",
    {
      title: "List MCP & API Audit Logs",
      description: "Inspect recent MCP tool invocations with actor email, tool name, shop affected, and latency.",
      inputSchema: {
        limit: z.number().int().min(1).max(100).optional().describe("Maximum logs to return (default: 25)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("list_audit_logs", "mcp:admin", ctx, async (args) =>
      listRecentAuditLogs(args.limit ?? 25),
    ),
  );
}
