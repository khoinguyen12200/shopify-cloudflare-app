import { support } from "~/wiring.server";
import { data } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { authenticateAdmin } from "~/admin/require-merchant.server";
import { getEnv } from "~/request-context.server";
import { attachmentKey, safeFilename, validateUpload } from "~/support/attachment";
import { getAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";

const STAGED_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;

type UploadFailure = ReturnType<typeof data<{ error: string }>>;

type StagedUpload = {
  readonly uploadId: string;
  readonly shop: string;
  readonly ticketId: string;
  readonly key: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
};

function failure(error: string, status: number): UploadFailure {
  return data({ error }, { status });
}

/**
 * Who the upload belongs to. Staff name the shop (or it is read off the ticket);
 * a merchant's shop is the authenticated session's, and a ticket id must be theirs.
 */
async function resolveUploadShop(
  request: Request,
  staff: unknown,
  ticketId: string,
): Promise<string | UploadFailure> {
  const explicitShop = request.headers.get("X-Shop");
  const shop = staff
    ? (explicitShop || (ticketId !== "new" ? (await support().findForStaff(ticketId))?.ticket.shop : undefined))
    : (await authenticateAdmin(request)).session.shop;
  if (!shop) return failure("not_found", 404);
  if (!staff && ticketId !== "new" && !(await support().find(shop, ticketId))) {
    return failure("not_found", 404);
  }
  return shop;
}

async function stageUpload(upload: StagedUpload): Promise<void> {
  const now = Date.now();
  await support().stageUpload({
    id: upload.uploadId,
    shop: upload.shop,
    ticketId: upload.ticketId === "new" ? null : upload.ticketId,
    r2Key: upload.key,
    filename: upload.filename,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
    createdAt: now,
    expiresAt: now + STAGED_UPLOAD_TTL_MS,
  });
}

/**
 * R2 stored more than the declared size allowed. Remove it; when removal fails,
 * stage the row anyway so the cron sweep can still find and delete the object.
 */
async function discardOversized(env: Env, upload: StagedUpload): Promise<void> {
  try {
    await env.UPLOADS.delete(upload.key);
  } catch (cleanupError) {
    console.error(JSON.stringify({
      event: "support.upload_size_cleanup_failed",
      error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    }));
    try {
      await stageUpload(upload);
    } catch (stagingError) {
      console.error(JSON.stringify({
        event: "support.upload_size_staging_failed",
        error: stagingError instanceof Error ? stagingError.message : String(stagingError),
      }));
    }
  }
}

/** Cron discovers abandoned objects through D1, so a failed insert compensates immediately. */
async function stageOrCompensate(env: Env, upload: StagedUpload): Promise<void> {
  try {
    await stageUpload(upload);
  } catch (stagingError) {
    try {
      await env.UPLOADS.delete(upload.key);
    } catch (cleanupError) {
      console.error(JSON.stringify({
        event: "support.upload_staging_cleanup_failed",
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      }));
    }
    throw stagingError;
  }
}

/** Uploads cost storage, so they share the limiter with ticket writes (fails open when absent). */
async function isRateLimited(env: Env, shop: string): Promise<boolean> {
  if (!env.SUPPORT_LIMITER) return false;
  const { success } = await env.SUPPORT_LIMITER.limit({ key: shop });
  return !success;
}

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

  if (request.method !== "POST") return failure("method_not_allowed", 405);

  const ticketId = request.headers.get("X-Support-Ticket") ?? "new";
  const staff = await getAdminUser(request, { users: adminUsers() });
  const shop = await resolveUploadShop(request, staff, ticketId);
  if (typeof shop !== "string") return shop;

  // Staff uploads bypass the limiter.
  if (!staff && (await isRateLimited(env, shop))) return failure("rate_limited", 429);

  const contentType = request.headers.get("Content-Type") ?? "";
  // Content-Length is the client's claim, checked here so an oversized upload
  // is refused before a byte is stored. The real size is verified after the
  // write, from what R2 actually received.
  const declared = Number(request.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(declared) || !Number.isInteger(declared) || declared <= 0) {
    return failure("empty", 400);
  }

  const check = validateUpload({ contentType, sizeBytes: declared });
  if (!check.ok) return failure(check.reason, 400);
  if (!request.body) return failure("empty", 400);

  const uploadId = crypto.randomUUID();
  const key = attachmentKey({ shop, ticketId, uploadId });
  const filename = safeFilename(request.headers.get("X-Support-Filename") ?? "file");

  const object = await env.UPLOADS.put(key, request.body, { httpMetadata: { contentType } });
  const upload: StagedUpload = { uploadId, shop, ticketId, key, filename, contentType, sizeBytes: object.size };

  // R2 reports what it actually stored. A client that under-declared its
  // Content-Length to get past the check above is caught here, and the object
  // is removed rather than left paid for.
  if (object.size > check.value.maxBytes) {
    await discardOversized(env, upload);
    return failure("too_large", 413);
  }

  await stageOrCompensate(env, upload);

  return data({ uploadId, r2Key: key, filename, contentType, sizeBytes: object.size });
};
