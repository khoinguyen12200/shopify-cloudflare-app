import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "./helpers.server";
import { getSystemHealth } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:read");

  const data = await withApiAudit(actor, "api:get_system_health", false, async () => {
    return getSystemHealth();
  });

  return apiJson(data);
}
