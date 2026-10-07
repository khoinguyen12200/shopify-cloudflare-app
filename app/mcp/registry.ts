import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from "./catalog";
import { registerAllTools } from "./tools";
import type { McpActorContext } from "./helpers";

/**
 * Build a fresh MCP server with the full tool surface bound to the given actor context.
 *
 * Tools close over `ctx` so that audit logging automatically attributes every action
 * to the verified actor and enforces permission scopes.
 */
export function buildMcpServer(ctx: McpActorContext): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });
  registerAllTools(server, ctx);
  return server;
}
