import { verifyBearerToken, type VerifiedActor } from "~/services/mcp/tokens.server";
import { hasRequiredScope, type McpScope } from "~/domain/mcp/scopes";
import { recordAuditLog } from "~/services/mcp/audit.server";

export const API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function handleOptions(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: API_CORS_HEADERS });
  }
  return null;
}

export function apiJson(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...API_CORS_HEADERS,
    },
  });
}

export function apiError(
  error: string,
  message: string,
  status = 400,
  extra?: Record<string, unknown>,
): Response {
  return new Response(
    JSON.stringify({ error, message, ...extra }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...API_CORS_HEADERS,
      },
    },
  );
}

/**
 * Authenticate incoming REST API request with a Bearer token and required scope.
 * Returns the verified actor or throws an HTTP Response with JSON error.
 */
export async function authenticateApiRequest(
  request: Request,
  requiredScope: McpScope,
): Promise<VerifiedActor> {
  const authHeader = request.headers.get("Authorization");
  const actor = await verifyBearerToken(authHeader);

  if (!actor) {
    throw new Response(
      JSON.stringify({
        error: "unauthorized",
        message: "Missing or invalid Bearer token",
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": 'Bearer realm="mcp-internal-admin"',
          ...API_CORS_HEADERS,
        },
      },
    );
  }

  if (!hasRequiredScope(actor.scopes, requiredScope)) {
    throw new Response(
      JSON.stringify({
        error: "forbidden",
        message: `Insufficient permissions. Requires scope: ${requiredScope}`,
        requiredScope,
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": `Bearer error="insufficient_scope", scope="${requiredScope}"`,
          ...API_CORS_HEADERS,
        },
      },
    );
  }

  return actor;
}

/** Wrapper to execute an API handler with automated audit logging. */
export async function withApiAudit<T>(
  actor: VerifiedActor,
  actionName: string,
  isMutation: boolean,
  fn: () => Promise<T>,
  shop?: string | null,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    await recordAuditLog({
      tokenId: actor.token.id,
      clientId: actor.token.clientId,
      actorEmail: actor.actorEmail,
      actorType: actor.actorType,
      toolName: actionName,
      shop: shop ?? null,
      isMutation,
      ok: true,
      latencyMs: duration,
    });
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    await recordAuditLog({
      tokenId: actor.token.id,
      clientId: actor.token.clientId,
      actorEmail: actor.actorEmail,
      actorType: actor.actorType,
      toolName: actionName,
      shop: shop ?? null,
      isMutation,
      ok: false,
      latencyMs: duration,
      errorMessage: msg,
    });
    throw err;
  }
}
