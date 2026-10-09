import type { HeadersFunction, LoaderFunctionArgs, ShouldRevalidateFunction } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useTranslation } from "react-i18next";

import { authenticateAdmin } from "~/admin/require-merchant.server";
import { useNavigationLoading } from "~/admin/use-navigation-loading";
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
  // Independent of each other: the identity write-through and the stored zone.
  const [, timeZone] = await Promise.all([
    persistShopIdentity(admin, session.shop),
    shopTimeZone(admin, session.shop),
  ]);

  // The public client_id, read from the Worker's env binding — there is no
  // process.env in workerd.
  //
  // The LOCALE needs no handling here: Shopify appends its `locale` parameter to
  // every GET it makes to an embedded app, and app/i18n/i18n.server.ts reads it
  // first in the detection order. So the app follows whatever language the
  // merchant picked in the Shopify admin, automatically. Do NOT add a language
  // switcher to this surface — the app would then be able to disagree with the
  // admin around it.
  return { apiKey: env.SHOPIFY_API_KEY || "", timeZone };
};

/**
 * This shell's data (the public API key and the shop's zone) is fixed for the
 * lifetime of the embedded session, so client-side navigations between /app
 * pages must not re-run it: every click would otherwise repeat the session-token
 * check and the D1 reads before the page's own loader even starts.
 *
 * Safe for auth because every child loader and action calls `authenticateAdmin`
 * itself (Shopify requires a valid session token on each request, and a failure
 * still throws the library's 401 / App Bridge bounce response from that child).
 * After an action the default applies, so the shell refreshes alongside the
 * data the action changed.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({ formMethod, defaultShouldRevalidate }) =>
  formMethod ? defaultShouldRevalidate : false;

export default function App() {
  const { apiKey, timeZone } = useLoaderData<typeof loader>();
  const { t } = useTranslation("admin");
  useNavigationLoading();

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
