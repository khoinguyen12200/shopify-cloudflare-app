import type { LoaderFunctionArgs } from "react-router";
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { getShopDossier } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:shops:read");
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return apiError("invalid_request", "Missing shop query parameter", 400);
  }

  const data = await withApiAudit(actor, "api:get_shop_dossier", false, async () => {
    return getShopDossier(shop);
  }, shop);

  if (!data) {
    return apiError("not_found", `Shop ${shop} was not found`, 404);
  }

  return apiJson(data);
}
