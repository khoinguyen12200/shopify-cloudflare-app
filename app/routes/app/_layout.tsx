import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useTranslation } from "react-i18next";

import { authenticateAdmin } from "~/admin/require-merchant.server";
import { getEnv } from "~/request-context.server";
import { persistShopIdentity, shopTimeZone } from "~/wiring.server";
import { TimeZoneProvider } from "~/i18n/useTimeZone";
import { thrownResponseHtml } from "~/lib/thrown-response";

/**
 * Namespaces for the embedded admin. `public` is deliberately absent — the
 * marketing and legal copy must not ship inside the admin bundle.
 */
export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const env = getEnv();
  const { admin, session } = await authenticateAdmin(request);
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
  return { apiKey: env.SHOPIFY_API_KEY || "", timeZone: await shopTimeZone(admin, session.shop) };
};

export default function App() {
  const { apiKey, timeZone } = useLoaderData<typeof loader>();
  const { t } = useTranslation("admin");

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app" rel="home">{t("nav.home")}</s-link>
        <s-link href="/app/billing">{t("nav.billing")}</s-link>
        <s-link href="/app/support">{t("nav.support")}</s-link>
      </s-app-nav>
      <TimeZoneProvider value={timeZone}>
        <Outlet />
      </TimeZoneProvider>
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses so their headers
// make it into the response. The one that matters on screen is the App Bridge
// "bounce" page; see `thrownResponseHtml` for why `boundary.error` cannot be
// used to render it from a minified bundle.
export function ErrorBoundary() {
  const error = useRouteError();
  const html = thrownResponseHtml(error);
  if (html !== null) return <div dangerouslySetInnerHTML={{ __html: html }} />;
  throw error;
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
