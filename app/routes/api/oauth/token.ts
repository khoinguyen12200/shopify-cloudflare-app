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

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
  }

  let body: Record<string, string> = {};
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    const parsed = await readJsonObject(request);
    if (!parsed) {
      return new Response(
        JSON.stringify({ error: "invalid_request", error_description: "Malformed JSON payload" }),
        { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
      );
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string") body[k] = v;
    }
  } else {
    try {
      const formData = await request.formData();
      for (const [k, v] of formData.entries()) {
        if (typeof v === "string") body[k] = v;
      }
    } catch {
      body = {};
    }
  }

  const grantType = body.grant_type ?? "";
  const clientId = body.client_id ?? "";
  const code = body.code ?? null;
  const codeVerifier = body.code_verifier ?? null;
  const redirectUri = body.redirect_uri ?? null;
  const refreshToken = body.refresh_token ?? null;

  if (!grantType || !clientId) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Missing grant_type or client_id",
      }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  }

  const result = await exchangeOAuthToken({
    grantType,
    clientId,
    code,
    codeVerifier,
    redirectUri,
    refreshToken,
  });

  if (!result.ok) {
    return new Response(
      JSON.stringify({
        error: result.error,
        error_description: result.description,
      }),
      {
        status: result.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          Pragma: "no-cache",
          ...CORS_HEADERS,
        },
      },
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
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        Pragma: "no-cache",
        ...CORS_HEADERS,
      },
    },
  );
}
