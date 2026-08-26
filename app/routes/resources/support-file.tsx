import type { LoaderFunctionArgs } from "react-router";
import { getEnv } from "~/request-context.server";
import { getAdminUser } from "~/services/admin-auth.server";
import { SupportRepo } from "~/models/support.server";
import { verifyAttachmentToken } from "~/support/file-token";

/**
 * Streams one support attachment back out of R2.
 *
 * The bucket is private, so this route is the only way to read an attachment,
 * and it authorises TWO different audiences against the same object:
 *
 *   - an internal staff member, whose console really does have a session
 *     cookie, and who may read any shop's attachment; and
 *   - anyone holding a signed token for THIS attachment, which the merchant
 *     thread's loader mints after proving, with a real Shopify session, that
 *     the shop owns it.
 *
 * The second branch is not a convenience. A merchant sees these files as
 * `<img>` and `<video>` inside the Shopify admin iframe, and a browser
 * subresource request carries neither the App Bridge session token nor a
 * usable cookie. Authenticating the request here does not fail cleanly either:
 * `authenticate.admin` answers an unauthenticated embedded request with a
 * **200 HTML bounce page**, which the browser cannot decode as an image — so
 * the thread showed a broken image with its filename instead of the screenshot.
 * Moving the authorisation into the URL is what fixes that.
 *
 * The token names the attachment id inside its signed payload, so moving the id
 * in the URL invalidates it: one merchant still cannot read another's files.
 */
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const env = getEnv();
  const id = params.id ?? "";

  // Not found and not-yours are the same response: a 404 on someone else's id
  // tells the asker it exists.
  const deny = () => new Response("Not found", { status: 404 });

  const attachment = await new SupportRepo().findAttachment(id);
  if (!attachment) return deny();

  if (!(await isAuthorised({ request, attachmentId: id, secret: env.SHOPIFY_API_SECRET }))) {
    return deny();
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
      // Private and short: the URL is bearer authorisation, so it must not sit
      // in a shared cache, and it must not outlive the token that carries it.
      "Cache-Control": "private, max-age=3600",
    },
  });
};

/** A signed URL, or a staff session. Either is enough; neither is not. */
async function isAuthorised({
  request,
  attachmentId,
  secret,
}: {
  request: Request;
  attachmentId: string;
  secret: string;
}): Promise<boolean> {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    const valid = await verifyAttachmentToken({
      secret,
      attachmentId,
      token,
      now: Date.now(),
    });
    if (valid) return true;
  }

  // `getAdminUser` returns undefined rather than redirecting, so an anonymous
  // request falls through to the 404 instead of being bounced to a login page
  // it could not render inside an <img> anyway.
  return (await getAdminUser(request)) !== undefined;
}
