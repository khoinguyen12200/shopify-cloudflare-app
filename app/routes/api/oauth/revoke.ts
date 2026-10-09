import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { revokeTokenById } from "~/services/mcp/tokens.server";
import { sha256 } from "~/domain/mcp/tokens";
import { mcpTokens } from "~/wiring.server";
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

  let tokenToRevoke = "";
  const contentType = request.headers.get("Content-Type") || "";

  if (contentType.includes("application/json")) {
    // Malformed JSON is a no-op: RFC 7009 answers 200 either way.
    const parsed = await readJsonObject(request);
    if (typeof parsed?.token === "string") tokenToRevoke = parsed.token;
  } else {
    try {
      const formData = await request.formData();
      const val = formData.get("token");
      if (typeof val === "string") tokenToRevoke = val;
    } catch {
      // Ignore formData error
    }
  }

  if (tokenToRevoke.trim()) {
    try {
      const hash = await sha256(tokenToRevoke.trim());
      const repo = mcpTokens();
      const row = await repo.findByHash(hash);
      if (row) {
        await revokeTokenById(row.id);
      }
    } catch {
      // RFC 7009 specifies returning 200 even on unresolvable tokens
    }
  }

  return new Response(JSON.stringify({ revoked: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}
