import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { persistShopIdentity } from "~/wiring.server";

/**
 * Namespaces for the embedded admin. `public` is deliberately absent — the
 * marketing and legal copy must not ship inside the admin bundle.
 */
export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const env = getEnv();
  const { admin, session } = await createShopify(env).authenticate.admin(request);
  await persistShopIdentity(admin, session.shop);

  // The public client_id, read from the Worker's env binding — there is no
  // process.env in workerd.
  //
  // The LOCALE needs no handling here: Shopify appends its `locale` parameter to
  // every GET it makes to an embedded app, and app/i18n/i18n.server.ts reads it
  // first in the detection order. So the app follows whatever language the
  // merchant picked in the Shopify admin, automatically. Do NOT add a language
  // switcher to this surface — the app would then be able to disagree with the
  // admin around it.
  return { apiKey: env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();
  const { t } = useTranslation("admin");

  return (
    <AppProvider apiKey={apiKey}>
      <NavMenu>
        {/* App Bridge requires the first child to be the app-root link. */}
        <a href="/app" rel="home">
          {t("nav.home")}
        </a>
        <a href="/app/billing">{t("nav.billing")}</a>
        <a href="/app/support">{t("nav.support")}</a>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses so their headers
// make it into the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
