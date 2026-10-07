import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { listWebhookFailures } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:read");
  const url = new URL(request.url);

  const shop = url.searchParams.get("shop") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam === "failed" || statusParam === "dead_letter" ? statusParam : undefined;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "20")));

  const data = await withApiAudit(actor, "api:list_webhook_failures", false, async () => {
    return listWebhookFailures({ shop, status, limit });
  }, shop);

  return apiJson(data);
}
