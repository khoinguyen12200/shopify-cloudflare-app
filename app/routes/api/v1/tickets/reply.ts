import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { replyToTicket } from "~/services/internal-admin/ops.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;
  return apiError("method_not_allowed", "Use POST to send a ticket reply", 405);
}

export async function action({ request }: ActionFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:tickets:write");

  let bodyData: Record<string, unknown>;
  try {
    bodyData = (await request.json()) as Record<string, unknown>;
  } catch {
    return apiError("invalid_request", "Expected JSON body", 400);
  }

  const ticketId = typeof bodyData.ticket_id === "string" ? bodyData.ticket_id.trim() : (typeof bodyData.id === "string" ? bodyData.id.trim() : "");
  const replyBody = typeof bodyData.body === "string" ? bodyData.body.trim() : "";
  const staffName = typeof bodyData.staff_name === "string" ? bodyData.staff_name.trim() : actor.actorEmail;
  const uploadIds = Array.isArray(bodyData.upload_ids)
    ? bodyData.upload_ids.filter((id): id is string => typeof id === "string")
    : [];
  const attachments = Array.isArray(bodyData.attachments)
    ? (bodyData.attachments as Array<{ filename?: unknown; contentType?: unknown; contentBase64?: unknown }>)
        .filter((a): a is { filename: string; contentType: string; contentBase64: string } =>
          typeof a.filename === "string" && typeof a.contentType === "string" && typeof a.contentBase64 === "string",
        )
    : [];

  if (!ticketId || !replyBody) {
    return apiError("invalid_request", "ticket_id and body are required fields", 400);
  }

  const result = await withApiAudit(
    actor,
    "api:reply_ticket",
    true,
    async () => {
      return replyToTicket({
        ticketId,
        body: replyBody,
        staffName,
        uploadIds,
        attachments,
      });
    },
  );

  if (!result.ok) {
    return apiError("not_found", `Ticket ${ticketId} not found`, 404);
  }

  return apiJson({
    ticketId,
    messageId: result.value.messageId,
    sent: true,
  });
}
