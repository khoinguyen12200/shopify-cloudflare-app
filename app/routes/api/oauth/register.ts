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

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: Record<string, unknown> = {};
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    const parsed = await readJsonObject(request);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "invalid_request", error_description: "Malformed JSON" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }
    body = parsed;
  } else {
    try {
      const formData = await request.formData();
      for (const [k, v] of formData.entries()) {
        body[k] = v;
      }
    } catch {
      body = {};
    }
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : "MCP AI Agent";
  const redirectUrisRaw = body.redirect_uris;

  let redirectUris: string[] = [];
  if (Array.isArray(redirectUrisRaw)) {
    redirectUris = redirectUrisRaw.filter((u): u is string => typeof u === "string");
  } else if (typeof redirectUrisRaw === "string") {
    redirectUris = [redirectUrisRaw];
  }

  if (redirectUris.length === 0) {
    return new Response(
      JSON.stringify({
        error: "invalid_redirect_uri",
        error_description: "redirect_uris must contain at least one valid URI",
      }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const client = await registerDynamicClient({
    clientName,
    redirectUris,
  });

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
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        ...CORS_HEADERS,
      },
    },
  );
}
