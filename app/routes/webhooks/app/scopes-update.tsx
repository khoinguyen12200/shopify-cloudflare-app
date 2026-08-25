import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { scopesUpdatePayloadSchema } from "~/schemas/webhooks";

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());
  const { payload, session, topic, shop } =
    await shopify.authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Persist the granted scopes back onto the stored session so the library
  // stops re-prompting for a grant it already has.
  if (session) {
    const parsed = scopesUpdatePayloadSchema.safeParse(payload);
    if (parsed.success) {
      session.scope = parsed.data.current.join(",");
      await shopify.sessionStorage.storeSession(session);
    } else {
      // Shopify's own shape changed under us, or this is a malformed
      // delivery — either way, corrupting the stored scope is worse than
      // leaving it stale until the next legitimate delivery.
      console.error(`Malformed ${topic} payload for ${shop}`, parsed.error.issues);
    }
  }

  return new Response();
};
