import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  apiError,
  apiJson,
  authenticateApiRequest,
  handleOptions,
  withApiAudit,
} from "../helpers.server";
import { uploadSupportAttachment } from "~/services/internal-admin/ops.server";
import { safeFilename, validateUpload, attachmentKey } from "~/support/attachment";
import { getEnv } from "~/request-context.server";
import { support } from "~/wiring.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;
  return apiError("method_not_allowed", "Use POST to upload support attachments", 405);
}

export async function action({ request }: ActionFunctionArgs) {
  const opt = handleOptions(request);
  if (opt) return opt;

  const actor = await authenticateApiRequest(request, "mcp:tickets:write");
  const contentTypeHeader = request.headers.get("Content-Type") ?? "";

  // 1. JSON with base64 payload
  if (contentTypeHeader.includes("application/json")) {
    let bodyData: Record<string, unknown>;
    try {
      bodyData = (await request.json()) as Record<string, unknown>;
    } catch {
      return apiError("invalid_request", "Expected valid JSON body", 400);
    }

    const shop = typeof bodyData.shop === "string" ? bodyData.shop.trim() : "";
    const filename = typeof bodyData.filename === "string" ? bodyData.filename.trim() : "";
    const contentType = typeof bodyData.content_type === "string" ? bodyData.content_type.trim() : (typeof bodyData.contentType === "string" ? bodyData.contentType.trim() : "");
    const contentBase64 = typeof bodyData.content_base64 === "string" ? bodyData.content_base64 : (typeof bodyData.contentBase64 === "string" ? bodyData.contentBase64 : "");
    const ticketId = typeof bodyData.ticket_id === "string" ? bodyData.ticket_id : (typeof bodyData.ticketId === "string" ? bodyData.ticketId : "new");

    if (!shop || !filename || !contentType || !contentBase64) {
      return apiError("invalid_request", "shop, filename, content_type, and content_base64 are required", 400);
    }

    try {
      const result = await withApiAudit(actor, "api:upload_attachment", true, async () => {
        return uploadSupportAttachment({
          shop,
          filename,
          contentType,
          contentBase64,
          ticketId,
        });
      }, shop);

      return apiJson(result, 201);
    } catch (e) {
      return apiError("upload_failed", e instanceof Error ? e.message : "Failed to process attachment", 400);
    }
  }

  // 2. Binary stream upload with headers
  const shop = request.headers.get("X-Shop")?.trim() ?? "";
  const ticketId = request.headers.get("X-Support-Ticket")?.trim() ?? "new";
  const rawFilename = request.headers.get("X-Support-Filename");
  const filename = rawFilename ? decodeURIComponent(rawFilename) : "file";
  const declared = Number(request.headers.get("Content-Length") ?? "0");

  if (!shop) {
    return apiError("invalid_request", "X-Shop header is required for binary upload", 400);
  }
  if (!Number.isFinite(declared) || declared <= 0) {
    return apiError("empty", "Declared Content-Length is missing or empty", 400);
  }

  const check = validateUpload({ contentType: contentTypeHeader, sizeBytes: declared });
  if (!check.ok) {
    return apiError(check.reason, `Upload validation failed: ${check.reason}`, 400);
  }

  const uploadId = crypto.randomUUID();
  const safeName = safeFilename(filename);
  const r2Key = attachmentKey({ shop, ticketId, uploadId });
  const env = getEnv();

  if (!request.body) {
    return apiError("empty", "Request body is empty", 400);
  }

  if (env.UPLOADS) {
    await env.UPLOADS.put(r2Key, request.body, {
      httpMetadata: { contentType: contentTypeHeader },
    });
  }

  const now = Date.now();
  await support().stageUpload({
    id: uploadId,
    shop,
    ticketId: ticketId === "new" ? null : ticketId,
    r2Key,
    filename: safeName,
    contentType: contentTypeHeader,
    sizeBytes: declared,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });

  return apiJson({
    uploadId,
    upload_id: uploadId,
    filename: safeName,
    contentType: contentTypeHeader,
    content_type: contentTypeHeader,
    sizeBytes: declared,
    size_bytes: declared,
  }, 201);
}
