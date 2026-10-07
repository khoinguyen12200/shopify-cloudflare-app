import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { getRevenueAndPlans } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:read");
  const url = new URL(request.url);
  const excludeDev = url.searchParams.get("exclude_dev") !== "false";

  const data = await withApiAudit(actor, "api:get_revenue_and_plans", false, async () => {
    return getRevenueAndPlans({ excludeDev });
  });

  return apiJson(data);
}
