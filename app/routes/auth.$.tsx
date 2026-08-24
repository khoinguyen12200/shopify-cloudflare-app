import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { ShopRepo } from "~/models/shops.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);

  // OAuth just completed — record (or revive) the install. Idempotent, so
  // re-auth and scope changes are no-ops.
  await new ShopRepo().recordInstall(session.shop, Date.now());

  return null;
};

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
