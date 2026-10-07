import {
  sqliteTable,
  text,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import { adminUsers } from "./admin-users";

/**
 * Registered OAuth applications and dynamic agent clients (RFC 7591).
 */
export const mcpClients = sqliteTable(
  "mcp_clients",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecretHash: text("client_secret_hash"),
    clientSecretPrefix: text("client_secret_prefix"),
    clientName: text("client_name").notNull(),
    clientType: text("client_type", { enum: ["confidential", "public"] })
      .notNull()
      .default("public"),
    registrationType: text("registration_type", { enum: ["dynamic", "manual"] })
      .notNull(),
    redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull(),
    allowedScopes: text("allowed_scopes", { mode: "json" }).$type<string[]>().notNull(),
    createdByAdminId: text("created_by_admin_id").references(() => adminUsers.id, {
      onDelete: "set null",
    }),
    createdAt: integer("created_at").notNull(),
    revokedAt: integer("revoked_at"),
  },
  (table) => [
    index("mcp_clients_client_id_idx").on(table.clientId),
    index("mcp_clients_revoked_at_idx").on(table.revokedAt),
  ],
);

export type McpClient = typeof mcpClients.$inferSelect;
export type NewMcpClient = typeof mcpClients.$inferInsert;

/**
 * Short-lived authorization codes during OAuth 2.0 PKCE handshake (10 min TTL).
 */
export const mcpAuthorizationCodes = sqliteTable(
  "mcp_authorization_codes",
  {
    id: text("id").primaryKey(),
    codeHash: text("code_hash").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => mcpClients.clientId, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    resource: text("resource"),
    codeChallenge: text("code_challenge").notNull(),
    codeChallengeMethod: text("code_challenge_method").notNull(),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("mcp_auth_codes_code_hash_idx").on(table.codeHash),
    index("mcp_auth_codes_client_id_idx").on(table.clientId),
    index("mcp_auth_codes_expires_at_idx").on(table.expiresAt),
  ],
);

export type McpAuthorizationCode = typeof mcpAuthorizationCodes.$inferSelect;
export type NewMcpAuthorizationCode = typeof mcpAuthorizationCodes.$inferInsert;

/**
 * Unified token storage for Personal Access Tokens (PATs) and OAuth Access/Refresh tokens.
 */
export const mcpTokens = sqliteTable(
  "mcp_tokens",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["pat", "access_token", "refresh_token"] }).notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    clientId: text("client_id").references(() => mcpClients.clientId, {
      onDelete: "cascade",
    }),
    adminUserId: text("admin_user_id").references(() => adminUsers.id, {
      onDelete: "cascade",
    }),
    label: text("label").notNull(),
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull(),
    parentTokenId: text("parent_token_id"),
    expiresAt: integer("expires_at"),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("mcp_tokens_token_hash_idx").on(table.tokenHash),
    index("mcp_tokens_client_id_idx").on(table.clientId),
    index("mcp_tokens_admin_user_id_idx").on(table.adminUserId),
    index("mcp_tokens_revoked_at_idx").on(table.revokedAt),
  ],
);

export type McpToken = typeof mcpTokens.$inferSelect;
export type NewMcpToken = typeof mcpTokens.$inferInsert;

/**
 * Observability audit log for all MCP tool and API calls.
 */
export const mcpAuditLogs = sqliteTable(
  "mcp_audit_logs",
  {
    id: text("id").primaryKey(),
    tokenId: text("token_id").references(() => mcpTokens.id, {
      onDelete: "set null",
    }),
    clientId: text("client_id").references(() => mcpClients.clientId, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email").notNull(),
    actorType: text("actor_type", { enum: ["staff_pat", "oauth_agent"] }).notNull(),
    toolName: text("tool_name").notNull(),
    shop: text("shop"),
    isMutation: integer("is_mutation", { mode: "boolean" }).notNull(),
    ok: integer("ok", { mode: "boolean" }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    errorMessage: text("error_message"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("mcp_audit_logs_created_at_idx").on(table.createdAt),
    index("mcp_audit_logs_tool_name_idx").on(table.toolName),
    index("mcp_audit_logs_shop_idx").on(table.shop),
    index("mcp_audit_logs_actor_email_idx").on(table.actorEmail),
  ],
);

export type McpAuditLog = typeof mcpAuditLogs.$inferSelect;
export type NewMcpAuditLog = typeof mcpAuditLogs.$inferInsert;
