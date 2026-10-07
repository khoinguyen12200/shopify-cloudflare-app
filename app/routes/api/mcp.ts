import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { verifyBearerToken } from "~/services/mcp/tokens.server";
import { dispatchHttpMcp } from "~/mcp/http-bridge";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "WWW-Authenticate",
  "Access-Control-Max-Age": "86400",
};

function unauthorized(request: Request): Response {
  const origin = new URL(request.url).origin;
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized: missing or invalid bearer token" },
      id: null,
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
        ...CORS_HEADERS,
      },
    },
  );
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST", ...CORS_HEADERS },
    });
  }

  const actor = await verifyBearerToken(request.headers.get("Authorization"));
  if (!actor) return unauthorized(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32700, message: "Parse error: body is not valid JSON" },
        id: null,
      }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const result = await dispatchHttpMcp(body, {
    actorEmail: actor.actorEmail,
    actorType: actor.actorType,
    transport: "http",
    tokenId: actor.token.id,
    clientId: actor.token.clientId,
    scopes: actor.scopes,
  });

  if (result.status === 202) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const actor = await verifyBearerToken(request.headers.get("Authorization"));
  if (!actor) return unauthorized(request);

  return new Response("Method Not Allowed: MCP endpoint requires POST with JSON-RPC body", {
    status: 405,
    headers: { Allow: "POST", ...CORS_HEADERS },
  });
}
