import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
} from "./helpers.server";
import { listRecentAuditLogs } from "~/services/mcp/audit.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  await authenticateApiRequest(request, "mcp:admin");
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "50")));

  const logs = await listRecentAuditLogs(limit);

  return apiJson({
    count: logs.length,
    logs: logs.map((l) => ({
      id: l.id,
      actorEmail: l.actorEmail,
      actorType: l.actorType,
      toolName: l.toolName,
      shop: l.shop,
      isMutation: l.isMutation,
      ok: l.ok,
      latencyMs: l.latencyMs,
      errorMessage: l.errorMessage,
      createdAt: l.createdAt,
    })),
  });
}
