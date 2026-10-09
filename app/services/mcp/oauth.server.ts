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
import { appRuntime, mcpOAuth, mcpTokens } from "~/wiring.server";
import type { McpAuthorizationCode, McpClient, McpToken } from "~/db/schema/mcp";
import type { Clock, Runtime } from "~/ports/runtime";

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
}, runtime: Runtime = appRuntime()): Promise<McpClient> {
  const clientId = generateClientId(runtime.randomBytes);
  const now = runtime.clock.now();

  return mcpOAuth().createClient({
    id: `cli_${runtime.ids.uuid()}`,
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
}: {
  clientId: string;
  adminUserId: string;
  redirectUri: string;
  scope: string;
  resource?: string | null;
  codeChallenge: string;
  codeChallengeMethod: string;
}, runtime: Runtime = appRuntime()): Promise<string> {
  const { raw, hash } = await generateAuthCode(runtime.randomBytes);
  const now = runtime.clock.now();

  await mcpOAuth().createAuthCode({
    id: `code_${runtime.ids.uuid()}`,
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

interface ExchangeInput {
  grantType: string;
  clientId: string;
  code?: string | null;
  codeVerifier?: string | null;
  redirectUri?: string | null;
  refreshToken?: string | null;
}

type ExchangeFailure = { ok: false; error: string; description: string; status: number };

export type ExchangeResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
      tokenType: "Bearer";
      scope: string;
    }
  | ExchangeFailure;

const invalidGrant = (description: string): ExchangeFailure => ({ ok: false, error: "invalid_grant", description, status: 400 });
const invalidRequest = (description: string): ExchangeFailure => ({ ok: false, error: "invalid_request", description, status: 400 });

const stripTrailingSlash = (uri: string): string => uri.replace(/\/$/, "");

/** Token exchange for authorization code and refresh token. */
export async function exchangeOAuthToken(input: ExchangeInput, runtime: Runtime = appRuntime()): Promise<ExchangeResult> {
  if (input.grantType === "authorization_code") return exchangeAuthorizationCode(input, runtime);
  if (input.grantType === "refresh_token") return exchangeRefreshToken(input, runtime);
  return { ok: false, error: "unsupported_grant_type", description: `Unsupported grant_type: ${input.grantType}`, status: 400 };
}

/** Why an authorization code cannot be redeemed, or null when it can. */
function authCodeRejection(authCode: McpAuthorizationCode, input: ExchangeInput, now: number): ExchangeFailure | null {
  if (authCode.usedAt !== null) return invalidGrant("Authorization code already used");
  if (now >= authCode.expiresAt) return invalidGrant("Authorization code expired");
  if (authCode.clientId !== input.clientId) return invalidGrant("client_id mismatch");
  if (input.redirectUri && stripTrailingSlash(authCode.redirectUri) !== stripTrailingSlash(input.redirectUri)) {
    return invalidGrant("redirect_uri mismatch");
  }
  return null;
}

async function exchangeAuthorizationCode(input: ExchangeInput, runtime: Runtime): Promise<ExchangeResult> {
  const { code, codeVerifier, clientId } = input;
  if (!code || !codeVerifier) return invalidRequest("Missing code or code_verifier");

  const now = runtime.clock.now();
  const oauthRepo = mcpOAuth();
  const authCode = await oauthRepo.findAuthCodeByHash(await sha256(code.trim()));
  if (!authCode) return invalidGrant("Invalid or expired authorization code");

  const rejection = authCodeRejection(authCode, input, now);
  if (rejection) return rejection;

  const validPkce = await verifyCodeChallenge({
    codeVerifier,
    codeChallenge: authCode.codeChallenge,
    method: authCode.codeChallengeMethod,
  });
  if (!validPkce) return invalidGrant("PKCE verification failed");

  await oauthRepo.markAuthCodeUsed(authCode.id, now);

  const refresh = await generateRefreshToken(runtime.randomBytes);
  const refreshRow = await mcpTokens().createToken({
    id: `ref_${runtime.ids.uuid()}`,
    type: "refresh_token",
    tokenHash: refresh.hash,
    tokenPrefix: refresh.prefix,
    clientId,
    adminUserId: authCode.adminUserId,
    label: `OAuth Refresh for ${clientId}`,
    scopes: parseScopes(authCode.scope),
    expiresAt: now + REFRESH_TOKEN_TTL_MS,
    createdAt: now,
  });

  const rawAccess = await createAccessToken(runtime, {
    clientId,
    adminUserId: authCode.adminUserId,
    label: `OAuth Access for ${clientId}`,
    scopes: parseScopes(authCode.scope),
    parentTokenId: refreshRow.id,
  });

  return bearerGrant(rawAccess, refresh.raw, authCode.scope);
}

async function exchangeRefreshToken(input: ExchangeInput, runtime: Runtime): Promise<ExchangeResult> {
  const { refreshToken } = input;
  if (!refreshToken) return invalidRequest("Missing refresh_token");

  const now = runtime.clock.now();
  const refreshRow = await mcpTokens().findByHash(await sha256(refreshToken.trim()));
  if (!refreshRow || refreshRow.type !== "refresh_token") return invalidGrant("Invalid refresh token");
  if (isTokenRevoked(refreshRow.revokedAt) || isTokenExpired(refreshRow.expiresAt, now)) {
    return invalidGrant("Refresh token revoked or expired");
  }

  const rawAccess = await createAccessToken(runtime, {
    clientId: refreshRow.clientId,
    adminUserId: refreshRow.adminUserId,
    label: `OAuth Access for ${refreshRow.clientId ?? "client"}`,
    scopes: refreshRow.scopes,
    parentTokenId: refreshRow.id,
  });

  return bearerGrant(rawAccess, refreshToken, refreshRow.scopes.join(" "));
}

/** Mint and persist an access token under a refresh token; returns the raw value. */
async function createAccessToken(
  runtime: Runtime,
  owner: Pick<McpToken, "clientId" | "adminUserId" | "label" | "scopes"> & { parentTokenId: string },
): Promise<string> {
  const now = runtime.clock.now();
  const access = await generateAccessToken(runtime.randomBytes);
  await mcpTokens().createToken({
    id: `tok_${runtime.ids.uuid()}`,
    type: "access_token",
    tokenHash: access.hash,
    tokenPrefix: access.prefix,
    clientId: owner.clientId,
    adminUserId: owner.adminUserId,
    label: owner.label,
    scopes: owner.scopes,
    parentTokenId: owner.parentTokenId,
    expiresAt: now + ACCESS_TOKEN_TTL_MS,
    createdAt: now,
  });
  return access.raw;
}

function bearerGrant(accessToken: string, refreshToken: string, scope: string): ExchangeResult {
  return {
    ok: true,
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    tokenType: "Bearer",
    scope,
  };
}

export async function listOAuthClients(): Promise<McpClient[]> {
  return mcpOAuth().listClients();
}

export async function revokeOAuthClientById(id: string, clock: Clock = appRuntime().clock): Promise<boolean> {
  return mcpOAuth().revokeClient(id, clock.now());
}
