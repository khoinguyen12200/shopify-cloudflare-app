import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());
  const { payload, session, topic, shop } =
    await shopify.authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Persist the granted scopes back onto the stored session so the library
  // stops re-prompting for a grant it already has.
  if (session) {
    const current = payload.current as string[];
    session.scope = current.toString();
    await shopify.sessionStorage.storeSession(session);
  }

  return new Response();
};
