import type { LoaderFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { getAdminUser } from "~/services/admin-auth.server";
import { SupportRepo } from "~/models/support.server";

/**
 * Streams one support attachment back out of R2.
 *
 * The bucket is private, so this route is the only way to read an attachment,
 * and it authorises TWO different audiences against the same object:
 *
 *   - an internal staff member, who may read any shop's attachment; and
 *   - a Shopify admin session, but ONLY for its own shop's attachment.
 *
 * The id is in a URL the merchant can edit, so the shop is compared against
 * the session rather than taken from the request. Getting this wrong would let
 * one merchant read another's screenshots, which is why the merchant branch
 * checks the owning shop before touching the bucket.
 */
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const env = getEnv();
  const attachment = await new SupportRepo().findAttachment(params.id ?? "");
  // Not found and not-yours are the same response: a 404 on someone else's id
  // tells the asker it exists.
  const deny = () => new Response("Not found", { status: 404 });
  if (!attachment) return deny();

  // Staff first: the internal session is cheaper to check and is not
  // shop-scoped. `getAdminUser` returns null rather than redirecting.
  const staff = await getAdminUser(request);
  if (!staff) {
    const { session } = await createShopify(env).authenticate.admin(request);
    if (session.shop !== attachment.shop) return deny();
  }

  const object = await env.UPLOADS.get(attachment.r2Key);
  if (!object) return deny();

  return new Response(object.body, {
    headers: {
      "Content-Type": attachment.contentType,
      "Content-Length": String(attachment.sizeBytes),
      // `inline` so an image or video renders in the thread instead of
      // downloading. The filename was sanitised on the way in
      // (app/support/attachment.ts) precisely because it lands in this header.
      "Content-Disposition": `inline; filename="${attachment.filename}"`,
      // Immutable: an attachment is never edited, only deleted with its shop.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
};
