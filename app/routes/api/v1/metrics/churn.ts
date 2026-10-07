import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { getChurnAndRetention } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:read");
  const url = new URL(request.url);
  const periodDays = Number(url.searchParams.get("period_days") || "30");

  const data = await withApiAudit(actor, "api:get_churn_and_retention", false, async () => {
    return getChurnAndRetention({ periodDays });
  });

  return apiJson(data);
}
