import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { setShopDevStatus } from "~/services/internal-admin/ops.server";
import { readJsonObject } from "~/lib/json-body";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;
  return apiError("method_not_allowed", "Use POST or PUT for updating dev status", 405);
}

export async function action({ request }: ActionFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:shops:write");

  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", "Expected JSON body", 400);

  const shop = typeof body.shop === "string" ? body.shop.trim() : "";
  const isDevStore = Boolean(body.is_dev_store ?? body.isDevStore);

  if (!shop) {
    return apiError("invalid_request", "Missing shop property in JSON body", 400);
  }

  const success = await withApiAudit(
    actor,
    "api:set_shop_dev_status",
    true,
    async () => {
      return setShopDevStatus(shop, isDevStore);
    },
    shop,
  );

  if (!success) {
    return apiError("not_found", `Shop ${shop} was not found`, 404);
  }

  return apiJson({ shop, isDevStore, updated: true });
}
