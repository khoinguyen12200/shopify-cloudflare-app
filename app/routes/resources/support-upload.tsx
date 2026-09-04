import { data } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { attachmentKey, safeFilename, validateUpload } from "~/support/attachment";
import { getAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { SupportRepo } from "~/models/support.server";

/**
 * One file, streamed straight into R2.
 *
 * Deliberately NOT part of the reply form's own submission. `request.formData()`
 * buffers the whole multipart body, so a merchant attaching a 100 MB screen
 * recording would put 100 MB into a 128 MB isolate and take the request down
 * with it. Here the body is piped to `bucket.put` without ever being held in
 * memory (@rules/cloudflare.md), and the composer posts the returned ids
 * alongside the message text.
 *
 * The object is written BEFORE any row exists, keyed by a fresh upload id. A
 * merchant who attaches a file and then abandons the form leaves an orphan
 * blob; the daily cron runs `runScheduledSweeps` to remove them. That is the deliberate
 * trade for never buffering.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const env = getEnv();

  if (request.method !== "POST") {
    return data({ error: "method_not_allowed" as const }, { status: 405 });
  }

  const ticketId = request.headers.get("X-Support-Ticket") ?? "new";
  const staff = await getAdminUser(request, { users: adminUsers() });
  const shop = staff
    ? (await new SupportRepo().findForStaff(ticketId))?.ticket.shop
    : (await createShopify(env).authenticate.admin(request)).session.shop;
  if (!shop) return data({ error: "not_found" as const }, { status: 404 });
  if (!staff && ticketId !== "new" && !(await new SupportRepo().find(shop, ticketId))) {
    return data({ error: "not_found" as const }, { status: 404 });
  }

  // Uploads cost storage, so they share the limiter with ticket writes. Fails
  // open when the binding is absent.
  if (env.SUPPORT_LIMITER) {
    const { success } = await env.SUPPORT_LIMITER.limit({ key: shop });
    if (!success) return data({ error: "rate_limited" as const }, { status: 429 });
  }
  const contentType = request.headers.get("Content-Type") ?? "";
  // Content-Length is the client's claim, checked here so an oversized upload
  // is refused before a byte is stored. The real size is verified after the
  // write, from what R2 actually received.
  const declared = Number(request.headers.get("Content-Length") ?? "0");

  const check = validateUpload({ contentType, sizeBytes: declared });
  if (!check.ok) {
    return data({ error: check.reason }, { status: 400 });
  }

  if (!request.body) {
    return data({ error: "empty" as const }, { status: 400 });
  }

  const uploadId = crypto.randomUUID();
  const key = attachmentKey({ shop, ticketId, uploadId });
  const filename = safeFilename(
    request.headers.get("X-Support-Filename") ?? "file",
  );

  const object = await env.UPLOADS.put(key, request.body, {
    httpMetadata: { contentType },
  });

  // R2 reports what it actually stored. A client that under-declared its
  // Content-Length to get past the check above is caught here, and the object
  // is removed rather than left paid for.
  if (object.size > check.value.maxBytes) {
    await env.UPLOADS.delete(key);
    return data({ error: "too_large" as const }, { status: 413 });
  }

  await new SupportRepo().stageUpload({
    id: uploadId, shop, ticketId: ticketId === "new" ? null : ticketId,
    r2Key: key, filename, contentType, sizeBytes: object.size,
    createdAt: Date.now(), expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return data({
    uploadId,
    r2Key: key,
    filename,
    contentType,
    sizeBytes: object.size,
  });
};
