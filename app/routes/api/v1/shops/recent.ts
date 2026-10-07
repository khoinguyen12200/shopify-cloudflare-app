import type { LoaderFunctionArgs } from "react-router";
import {
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { listNewStores } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:shops:read");
  const url = new URL(request.url);
  const sinceHours = Number(url.searchParams.get("since_hours") || "24");
  const typeParam = url.searchParams.get("type");
  const type = typeParam === "real" || typeParam === "dev" ? typeParam : "all";

  const data = await withApiAudit(actor, "api:list_new_stores", false, async () => {
    return listNewStores({ sinceHours, type });
  });

  return apiJson(data);
}
