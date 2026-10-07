import { nanoid } from "nanoid";
import {
  generateAccessToken,
  generateAuthCode,
  generateClientId,
  generateRefreshToken,
  isTokenExpired,
  isTokenRevoked,
  sha256,
} from "~/domain/mcp/tokens";
import { parseScopes, type McpScope } from "~/domain/mcp/scopes";
import { verifyCodeChallenge } from "~/domain/mcp/pkce";
import { mcpOAuth, mcpTokens } from "~/wiring.server";
import type { McpClient } from "~/db/schema/mcp";

const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** RFC 7591: Dynamic Client Registration. */
export async function registerDynamicClient({
  clientName,
  redirectUris,
}: {
  clientName: string;
  redirectUris: readonly string[];
}): Promise<McpClient> {
  const clientId = generateClientId();
  const now = Date.now();

  return mcpOAuth().createClient({
    id: `cli_${nanoid()}`,
    clientId,
    clientName: clientName.trim(),
    clientType: "public",
    registrationType: "dynamic",
    redirectUris: [...redirectUris],
    allowedScopes: ["mcp:read", "mcp:tickets:write", "mcp:shops:read"],
    createdAt: now,
  });
}

/** Validate an incoming authorization request before showing the consent screen. */
export async function validateAuthorizeRequest({
  clientId,
  redirectUri,
  responseType,
  scope,
}: {
  clientId?: string | null;
  redirectUri?: string | null;
  responseType?: string | null;
  scope?: string | null;
}): Promise<
  | { ok: true; client: McpClient; scopes: McpScope[]; redirectUri: string }
  | { ok: false; error: string; description: string }
> {
  if (!clientId) {
    return { ok: false, error: "invalid_request", description: "Missing client_id" };
  }
  if (!redirectUri) {
    return { ok: false, error: "invalid_request", description: "Missing redirect_uri" };
  }
  if (responseType !== "code") {
    return { ok: false, error: "unsupported_response_type", description: "response_type must be 'code'" };
  }

  const client = await mcpOAuth().findClientByClientId(clientId);
  if (!client || client.revokedAt !== null) {
    return { ok: false, error: "unauthorized_client", description: "Client not found or revoked" };
  }

  const validUri = client.redirectUris.some(
    (uri) => uri === redirectUri || uri.replace(/\/$/, "") === redirectUri.replace(/\/$/, ""),
  );
  if (!validUri) {
    return { ok: false, error: "invalid_redirect_uri", description: "Redirect URI not registered for this client" };
  }

  const scopes = parseScopes(scope);
  return { ok: true, client, scopes, redirectUri };
}

/** Issue a temporary authorization code after staff consent. */
export async function issueAuthorizationCode({
  clientId,
  adminUserId,
  redirectUri,
  scope,
  resource,
  codeChallenge,
  codeChallengeMethod,
  now = Date.now(),
}: {
  clientId: string;
  adminUserId: string;
  redirectUri: string;
  scope: string;
  resource?: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
  now?: number;
}): Promise<string> {
  const { raw, hash } = await generateAuthCode();

  await mcpOAuth().createAuthCode({
    id: `code_${nanoid()}`,
    codeHash: hash,
    clientId,
    adminUserId,
    redirectUri,
    scope,
    resource: resource ?? null,
    codeChallenge,
    codeChallengeMethod: codeChallengeMethod || "S256",
    expiresAt: now + AUTH_CODE_TTL_MS,
    createdAt: now,
  });

  return raw;
}

/** Token exchange for authorization code and refresh token. */
export async function exchangeOAuthToken({
  grantType,
  clientId,
  code,
  codeVerifier,
  redirectUri,
  refreshToken,
  now = Date.now(),
}: {
  grantType: string;
  clientId: string;
  code?: string | null;
  codeVerifier?: string | null;
  redirectUri?: string | null;
  refreshToken?: string | null;
  now?: number;
}): Promise<
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: "Bearer";
      scope: string;
    }
  | { ok: false; error: string; description: string; status: number }
> {
  if (grantType === "authorization_code") {
    if (!code || !codeVerifier) {
      return { ok: false, error: "invalid_request", description: "Missing code or code_verifier", status: 400 };
    }

    const codeHash = await sha256(code.trim());
    const oauthRepo = mcpOAuth();
    const authCode = await oauthRepo.findAuthCodeByHash(codeHash);

    if (!authCode) {
      return { ok: false, error: "invalid_grant", description: "Invalid or expired authorization code", status: 400 };
    }
    if (authCode.usedAt !== null) {
      return { ok: false, error: "invalid_grant", description: "Authorization code already used", status: 400 };
    }
    if (now >= authCode.expiresAt) {
      return { ok: false, error: "invalid_grant", description: "Authorization code expired", status: 400 };
    }
    if (authCode.clientId !== clientId) {
      return { ok: false, error: "invalid_grant", description: "client_id mismatch", status: 400 };
    }
    if (redirectUri && authCode.redirectUri.replace(/\/$/, "") !== redirectUri.replace(/\/$/, "")) {
      return { ok: false, error: "invalid_grant", description: "redirect_uri mismatch", status: 400 };
    }

    const validPkce = await verifyCodeChallenge({
      codeVerifier,
      codeChallenge: authCode.codeChallenge,
      method: authCode.codeChallengeMethod,
    });
    if (!validPkce) {
      return { ok: false, error: "invalid_grant", description: "PKCE verification failed", status: 400 };
    }

    await oauthRepo.markAuthCodeUsed(authCode.id, now);

    const tokenRepo = mcpTokens();
    const { raw: rawRefresh, hash: refreshHash, prefix: refreshPrefix } = await generateRefreshToken();
    const refreshRow = await tokenRepo.createToken({
      id: `ref_${nanoid()}`,
      type: "refresh_token",
      tokenHash: refreshHash,
      tokenPrefix: refreshPrefix,
      clientId,
      adminUserId: authCode.adminUserId,
      label: `OAuth Refresh for ${clientId}`,
      scopes: parseScopes(authCode.scope),
      expiresAt: now + REFRESH_TOKEN_TTL_MS,
      createdAt: now,
    });

    const { raw: rawAccess, hash: accessHash, prefix: accessPrefix } = await generateAccessToken();
    await tokenRepo.createToken({
      id: `tok_${nanoid()}`,
      type: "access_token",
      tokenHash: accessHash,
      tokenPrefix: accessPrefix,
      clientId,
      adminUserId: authCode.adminUserId,
      label: `OAuth Access for ${clientId}`,
      scopes: parseScopes(authCode.scope),
      parentTokenId: refreshRow.id,
      expiresAt: now + ACCESS_TOKEN_TTL_MS,
      createdAt: now,
    });

    return {
      ok: true,
      accessToken: rawAccess,
      refreshToken: rawRefresh,
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      tokenType: "Bearer",
      scope: authCode.scope,
    };
  }

  if (grantType === "refresh_token") {
    if (!refreshToken) {
      return { ok: false, error: "invalid_request", description: "Missing refresh_token", status: 400 };
    }

    const refreshHash = await sha256(refreshToken.trim());
    const tokenRepo = mcpTokens();
    const refreshRow = await tokenRepo.findByHash(refreshHash);

    if (!refreshRow || refreshRow.type !== "refresh_token") {
      return { ok: false, error: "invalid_grant", description: "Invalid refresh token", status: 400 };
    }
    if (isTokenRevoked(refreshRow.revokedAt) || isTokenExpired(refreshRow.expiresAt, now)) {
      return { ok: false, error: "invalid_grant", description: "Refresh token revoked or expired", status: 400 };
    }

    const { raw: rawAccess, hash: accessHash, prefix: accessPrefix } = await generateAccessToken();
    await tokenRepo.createToken({
      id: `tok_${nanoid()}`,
      type: "access_token",
      tokenHash: accessHash,
      tokenPrefix: accessPrefix,
      clientId: refreshRow.clientId,
      adminUserId: refreshRow.adminUserId,
      label: `OAuth Access for ${refreshRow.clientId ?? "client"}`,
      scopes: refreshRow.scopes,
      parentTokenId: refreshRow.id,
      expiresAt: now + ACCESS_TOKEN_TTL_MS,
      createdAt: now,
    });

    return {
      ok: true,
      accessToken: rawAccess,
      refreshToken,
      expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      tokenType: "Bearer",
      scope: refreshRow.scopes.join(" "),
    };
  }

  return { ok: false, error: "unsupported_grant_type", description: `Unsupported grant_type: ${grantType}`, status: 400 };
}

export async function listOAuthClients(): Promise<McpClient[]> {
  return mcpOAuth().listClients();
}

export async function revokeOAuthClientById(id: string, now = Date.now()): Promise<boolean> {
  return mcpOAuth().revokeClient(id, now);
}
