import type { ActionFunctionArgs } from "react-router";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { ShopRepo } from "~/models/shops.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const shopify = createShopify(getEnv());
  const { shop, session, topic } = await shopify.authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhooks can fire more than once, and after the app is already gone — both
  // steps below are idempotent, so a repeat delivery is a no-op rather than an
  // error.
  await new ShopRepo().recordUninstall(shop, Date.now());

  if (session) {
    const sessions = await shopify.sessionStorage.findSessionsByShop(shop);
    await shopify.sessionStorage.deleteSessions(sessions.map((s) => s.id));
  }

  return new Response();
};
