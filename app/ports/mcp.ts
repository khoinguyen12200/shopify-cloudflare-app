import type {
  McpAuditLog,
  McpAuthorizationCode,
  McpClient,
  McpToken,
  NewMcpAuditLog,
  NewMcpAuthorizationCode,
  NewMcpClient,
  NewMcpToken,
} from "~/db/schema/mcp";

export interface McpTokenPort {
  createToken(token: NewMcpToken): Promise<McpToken>;
  findByHash(tokenHash: string): Promise<McpToken | undefined>;
  listTokens(): Promise<McpToken[]>;
  listTokensForAdmin(adminUserId: string): Promise<McpToken[]>;
  revokeToken(id: string, now: number): Promise<boolean>;
  recordUsage(id: string, now: number): Promise<void>;
}

export interface McpOAuthPort {
  createClient(client: NewMcpClient): Promise<McpClient>;
  findClientByClientId(clientId: string): Promise<McpClient | undefined>;
  listClients(): Promise<McpClient[]>;
  revokeClient(id: string, now: number): Promise<boolean>;
  createAuthCode(code: NewMcpAuthorizationCode): Promise<McpAuthorizationCode>;
  findAuthCodeByHash(codeHash: string): Promise<McpAuthorizationCode | undefined>;
  markAuthCodeUsed(id: string, now: number): Promise<void>;
}

export interface McpAuditLogPort {
  createLog(log: NewMcpAuditLog): Promise<void>;
  listRecentLogs(limit?: number): Promise<McpAuditLog[]>;
}

export interface McpRepositoryPort {
  tokens: McpTokenPort;
  oauth: McpOAuthPort;
  audit: McpAuditLogPort;
}
