import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpActorContext } from "../helpers";
import { registerMetricsTools } from "./metrics";
import { registerShopTools } from "./shops";
import { registerTicketTools } from "./tickets";
import { registerAuditTools } from "./audit";

/** Register all 15 operational tools onto an McpServer instance bound to an actor context. */
export function registerAllTools(server: McpServer, ctx: McpActorContext) {
  registerMetricsTools(server, ctx);
  registerShopTools(server, ctx);
  registerTicketTools(server, ctx);
  registerAuditTools(server, ctx);
}
