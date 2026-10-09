import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { registerDynamicClient } from "~/services/mcp/oauth.server";
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

function oauthError(error: string, description: string): Response {
  return new Response(
    JSON.stringify({ error, error_description: description }),
    { status: 400, headers: JSON_HEADERS },
  );
}

/** JSON or form-encoded registration body; null means malformed JSON. */
async function readRegistrationBody(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return (await readJsonObject(request)) ?? null;
  const body: Record<string, unknown> = {};
  try {
    const formData = await request.formData();
    for (const [k, v] of formData.entries()) {
      body[k] = v;
    }
    return body;
  } catch {
    return {};
  }
}

function parseRedirectUris(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((u): u is string => typeof u === "string");
  return typeof raw === "string" ? [raw] : [];
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  const body = await readRegistrationBody(request);
  if (!body) return oauthError("invalid_request", "Malformed JSON");

  const clientName = typeof body.client_name === "string" ? body.client_name : "MCP AI Agent";
  const redirectUris = parseRedirectUris(body.redirect_uris);
  if (redirectUris.length === 0) {
    return oauthError("invalid_redirect_uri", "redirect_uris must contain at least one valid URI");
  }

  const client = await registerDynamicClient({ clientName, redirectUris });

  return new Response(
    JSON.stringify({
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...CORS_HEADERS },
    },
  );
}
