import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import {
  mcpAuditLogs,
  mcpAuthorizationCodes,
  mcpClients,
  mcpTokens,
  type McpAuditLog,
  type McpAuthorizationCode,
  type McpClient,
  type McpToken,
  type NewMcpAuditLog,
  type NewMcpAuthorizationCode,
  type NewMcpClient,
  type NewMcpToken,
} from "~/db/schema/mcp";
import type {
  McpAuditLogPort,
  McpOAuthPort,
  McpTokenPort,
} from "~/ports/mcp";

/**
 * Persistence adapter for Personal Access Tokens and OAuth Access/Refresh tokens.
 */
export class McpTokenRepo implements McpTokenPort {
  async createToken(token: NewMcpToken): Promise<McpToken> {
    const [row] = await getDb()
      .insert(mcpTokens)
      .values(token)
      .returning();
    if (!row) throw new Error("Failed to insert token");
    return row;
  }

  async findByHash(tokenHash: string): Promise<McpToken | undefined> {
    const rows = await getDb()
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.tokenHash, tokenHash))
      .limit(1);
    return rows[0];
  }

  async listTokens(): Promise<McpToken[]> {
    return getDb()
      .select()
      .from(mcpTokens)
      .orderBy(desc(mcpTokens.createdAt));
  }

  async listTokensForAdmin(adminUserId: string): Promise<McpToken[]> {
    return getDb()
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.adminUserId, adminUserId))
      .orderBy(desc(mcpTokens.createdAt));
  }

  async revokeToken(id: string, now: number): Promise<boolean> {
    const result = await getDb()
      .update(mcpTokens)
      .set({ revokedAt: now })
      .where(and(eq(mcpTokens.id, id), isNull(mcpTokens.revokedAt)))
      .returning({ id: mcpTokens.id });
    return result.length > 0;
  }

  async recordUsage(id: string, now: number): Promise<void> {
    await getDb()
      .update(mcpTokens)
      .set({ lastUsedAt: now })
      .where(eq(mcpTokens.id, id));
  }
}

/**
 * Persistence adapter for OAuth Clients and temporary Authorization Codes.
 */
export class McpOAuthRepo implements McpOAuthPort {
  async createClient(client: NewMcpClient): Promise<McpClient> {
    const [row] = await getDb()
      .insert(mcpClients)
      .values(client)
      .returning();
    if (!row) throw new Error("Failed to insert client");
    return row;
  }

  async findClientByClientId(clientId: string): Promise<McpClient | undefined> {
    const rows = await getDb()
      .select()
      .from(mcpClients)
      .where(eq(mcpClients.clientId, clientId))
      .limit(1);
    return rows[0];
  }

  async listClients(): Promise<McpClient[]> {
    return getDb()
      .select()
      .from(mcpClients)
      .orderBy(desc(mcpClients.createdAt));
  }

  async revokeClient(id: string, now: number): Promise<boolean> {
    const result = await getDb()
      .update(mcpClients)
      .set({ revokedAt: now })
      .where(and(eq(mcpClients.id, id), isNull(mcpClients.revokedAt)))
      .returning({ id: mcpClients.id });
    return result.length > 0;
  }

  async createAuthCode(code: NewMcpAuthorizationCode): Promise<McpAuthorizationCode> {
    const [row] = await getDb()
      .insert(mcpAuthorizationCodes)
      .values(code)
      .returning();
    if (!row) throw new Error("Failed to insert authorization code");
    return row;
  }

  async findAuthCodeByHash(codeHash: string): Promise<McpAuthorizationCode | undefined> {
    const rows = await getDb()
      .select()
      .from(mcpAuthorizationCodes)
      .where(eq(mcpAuthorizationCodes.codeHash, codeHash))
      .limit(1);
    return rows[0];
  }

  async markAuthCodeUsed(id: string, now: number): Promise<void> {
    await getDb()
      .update(mcpAuthorizationCodes)
      .set({ usedAt: now })
      .where(eq(mcpAuthorizationCodes.id, id));
  }
}

/**
 * Persistence adapter for MCP tool execution audit logs.
 */
export class McpAuditLogRepo implements McpAuditLogPort {
  async createLog(log: NewMcpAuditLog): Promise<void> {
    await getDb().insert(mcpAuditLogs).values(log);
  }

  async listRecentLogs(limit = 25): Promise<McpAuditLog[]> {
    return getDb()
      .select()
      .from(mcpAuditLogs)
      .orderBy(desc(mcpAuditLogs.createdAt))
      .limit(limit);
  }
}
