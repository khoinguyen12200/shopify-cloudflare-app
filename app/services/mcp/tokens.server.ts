import { nanoid } from "nanoid";
import {
  generatePat,
  isTokenExpired,
  isTokenRevoked,
  sha256,
} from "~/domain/mcp/tokens";
import { parseScopes } from "~/domain/mcp/scopes";
import { mcpTokens } from "~/wiring.server";
import type { McpToken } from "~/db/schema/mcp";

export interface VerifiedActor {
  readonly token: McpToken;
  readonly actorEmail: string;
  readonly actorType: "staff_pat" | "oauth_agent";
  readonly scopes: readonly string[];
}

export async function createPersonalAccessToken({
  label,
  adminUserId,
  adminEmail: _adminEmail,
  scopes,
  expiresInDays,
}: {
  label: string;
  adminUserId: string;
  adminEmail: string;
  scopes?: readonly string[];
  expiresInDays?: number | null;
}): Promise<{ rawToken: string; token: McpToken }> {
  const { raw, hash, prefix } = await generatePat();
  const now = Date.now();
  const expiresAt = expiresInDays ? now + expiresInDays * 24 * 60 * 60 * 1000 : null;

  const validScopes = parseScopes(scopes);

  const token = await mcpTokens().createToken({
    id: `pat_${nanoid()}`,
    type: "pat",
    tokenHash: hash,
    tokenPrefix: prefix,
    adminUserId,
    label: label.trim(),
    scopes: validScopes,
    expiresAt,
    createdAt: now,
  });

  return { rawToken: raw, token };
}

/**
 * Verify a bearer token from the Authorization header.
 *
 * Updates lastUsedAt asynchronously on success.
 */
export async function verifyBearerToken(
  authHeader: string | null | undefined,
  now = Date.now(),
): Promise<VerifiedActor | null> {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) return null;

  const rawToken = match[1].trim();
  const tokenHash = await sha256(rawToken);

  const tokenRepo = mcpTokens();
  const token = await tokenRepo.findByHash(tokenHash);
  if (!token) return null;

  if (isTokenRevoked(token.revokedAt)) return null;
  if (isTokenExpired(token.expiresAt, now)) return null;

  // Track usage asynchronously without blocking the response
  tokenRepo.recordUsage(token.id, now).catch(() => {});

  const actorType: "staff_pat" | "oauth_agent" =
    token.type === "pat" ? "staff_pat" : "oauth_agent";

  return {
    token,
    actorEmail: token.label,
    actorType,
    scopes: token.scopes,
  };
}

export async function listPersonalAccessTokens(): Promise<McpToken[]> {
  const all = await mcpTokens().listTokens();
  return all.filter((t) => t.type === "pat");
}

export async function revokeTokenById(id: string, now = Date.now()): Promise<boolean> {
  return mcpTokens().revokeToken(id, now);
}
