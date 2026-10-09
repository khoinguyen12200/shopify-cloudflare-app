import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { exchangeOAuthToken } from "~/services/mcp/oauth.server";
import { readJsonObject } from "~/lib/json-body";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
}

const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };
const NO_STORE_JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  Pragma: "no-cache",
  ...CORS_HEADERS,
};

function oauthError(error: string, description: string): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    { status: 400, headers: JSON_HEADERS },
  );
}

function stringEntries(entries: Iterable<[string, unknown]>): Record<string, string> {
  const body: Record<string, string> = {};
  for (const [k, v] of entries) {
    if (typeof v === "string") body[k] = v;
  }
  return body;
}

/** The token endpoint accepts JSON or form-encoded bodies; null means malformed JSON. */
async function readTokenBody(request: Request): Promise<Record<string, string> | null> {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const parsed = await readJsonObject(request);
    return parsed ? stringEntries(Object.entries(parsed)) : null;
  }
  try {
    const formData = await request.formData();
    return stringEntries(formData.entries());
  } catch {
    return {};
  }
}

type ExchangeResult = Awaited<ReturnType<typeof exchangeOAuthToken>>;

function tokenResponse(result: ExchangeResult): Response {
  if (!result.ok) {
    return new Response(
      JSON.stringify({ error: result.error, error_description: result.description }),
      { status: result.status, headers: NO_STORE_JSON_HEADERS },
    );
  }
  return new Response(
    JSON.stringify({
      access_token: result.accessToken,
      token_type: result.tokenType,
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
      scope: result.scope,
    }),
    { status: 200, headers: NO_STORE_JSON_HEADERS },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  const body = await readTokenBody(request);
  if (!body) return oauthError("invalid_request", "Malformed JSON payload");

  const grantType = body.grant_type ?? "";
  const clientId = body.client_id ?? "";
  if (!grantType || !clientId) {
    return oauthError("invalid_request", "Missing grant_type or client_id");
  }

  return tokenResponse(
    await exchangeOAuthToken({
      grantType,
      clientId,
      code: body.code ?? null,
      codeVerifier: body.code_verifier ?? null,
      redirectUri: body.redirect_uri ?? null,
      refreshToken: body.refresh_token ?? null,
    }),
  );
}
