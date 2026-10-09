import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import {
  closeTicket,
  getTicketThread,
} from "~/services/internal-admin/ops.server";
import { readJsonObject } from "~/lib/json-body";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:read");
  const url = new URL(request.url);
  const ticketId = url.searchParams.get("ticket_id") || url.searchParams.get("id");

  if (!ticketId) {
    return apiError("invalid_request", "Missing ticket_id parameter", 400);
  }

  const data = await withApiAudit(actor, "api:get_ticket_thread", false, async () => {
    return getTicketThread(ticketId);
  });

  if (!data) {
    return apiError("not_found", `Ticket ${ticketId} not found`, 404);
  }

  return apiJson(data);
}

export async function action({ request }: ActionFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:tickets:write");

  const body = await readJsonObject(request);
  if (!body) return apiError("invalid_request", "Expected JSON body", 400);

  const ticketId = typeof body.ticket_id === "string" ? body.ticket_id.trim() : (typeof body.id === "string" ? body.id.trim() : "");
  const intent = typeof body.intent === "string" ? body.intent.trim() : "close";

  if (!ticketId) {
    return apiError("invalid_request", "Missing ticket_id", 400);
  }

  if (intent === "close") {
    const updated = await withApiAudit(actor, "api:close_ticket", true, async () => {
      return closeTicket(ticketId);
    });
    return apiJson({ ticketId, closed: Boolean(updated) });
  }

  return apiError("unsupported_intent", `Unknown intent: ${intent}`, 400);
}
