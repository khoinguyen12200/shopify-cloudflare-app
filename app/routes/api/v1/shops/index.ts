import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { listShopsDirectory } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:shops:read");
  const url = new URL(request.url);

  const filterParam = url.searchParams.get("filter");
  const filter = filterParam === "active" || filterParam === "uninstalled" ? filterParam : "all";

  const typeParam = url.searchParams.get("type");
  const type = typeParam === "real" || typeParam === "dev" ? typeParam : "all";

  const plan = url.searchParams.get("plan") ?? undefined;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "50")));

  const data = await withApiAudit(actor, "api:list_shops", false, async () => {
    return listShopsDirectory({ filter, type, plan, limit });
  });

  return apiJson(data);
}
