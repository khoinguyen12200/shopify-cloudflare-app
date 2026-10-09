import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import {
  createTicketOnBehalf,
  listTickets,
} from "~/services/internal-admin/ops.server";
import { toSupportCategory } from "~/support/categories";
import { parseInlineAttachments, readJsonObject } from "~/lib/json-body";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:read");
  const url = new URL(request.url);

  const statusParam = url.searchParams.get("status");
  const status = statusParam === "closed" || statusParam === "all" ? statusParam : "open";
  const unreadOnly = url.searchParams.get("unread_only") === "true";
  const category = url.searchParams.get("category") ?? undefined;
  const shop = url.searchParams.get("shop") ?? undefined;
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "50")));

  const data = await withApiAudit(actor, "api:list_tickets", false, async () => {
    return listTickets({ status, unreadOnly, category, shop, limit });
  }, shop);

  return apiJson(data);
}

export async function action({ request }: ActionFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:tickets:write");

  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", "Expected JSON body", 400);

  const shop = typeof body.shop === "string" ? body.shop.trim() : "";
  const shopName = typeof body.shop_name === "string" ? body.shop_name.trim() : undefined;
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const bodyText = typeof body.body === "string" ? body.body.trim() : "";
  const category = toSupportCategory(typeof body.category === "string" ? body.category.trim() : "") ?? "question";
  const merchantEmail = typeof body.merchant_email === "string" ? body.merchant_email.trim() : null;

  const uploadIds = Array.isArray(body.upload_ids)
    ? body.upload_ids.filter((id): id is string => typeof id === "string")
    : [];
  const attachments = parseInlineAttachments(body.attachments);

  const result = await withApiAudit(
    actor,
    "api:create_ticket",
    true,
    async () => {
      return createTicketOnBehalf({
        shop,
        shopName,
        subject,
        body: bodyText,
        category,
        merchantEmail,
        uploadIds,
        attachments,
      });
    },
    shop,
  );

  return apiJson(result, 201);
}
