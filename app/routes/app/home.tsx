import { shops } from "~/wiring.server";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { redirect, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDateTime } from "~/i18n/format";
import { persistShopIdentity } from "~/wiring.server";
import { pricingReturnDestination } from "~/billing/pricing-return";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } =
    await createShopify(getEnv()).authenticate.admin(request);
  await persistShopIdentity(admin, session.shop);

  // Let Billing render its processing state before it reconciles Shopify truth.
  const destination = pricingReturnDestination(request.url);
  if (destination) throw redirect(destination);

  // The Admin GraphQL call and the D1 read are independent — both need only
  // `session.shop` — so they run concurrently instead of one full round trip
  // waiting on the other.
  const [response, record] = await Promise.all([
    // A read-only Admin GraphQL call, to prove the client is wired end to end.
    admin.graphql(
      `#graphql
        query ScaffoldShop {
          shop {
            name
            myshopifyDomain
          }
        }`,
    ),
    // A D1 read through the models layer, to prove that half is wired too.
    shops().get(session.shop),
  ]);
  const body = await response.json();

  return {
    shopName: body.data?.shop?.name ?? session.shop,
    installedAt: record?.installedAt ?? null,
  };
};

export default function Index() {
  const { shopName, installedAt } = useLoaderData<typeof loader>();
  const { t } = useTranslation("admin");
  const locale = useLocale();

  return (
    <s-page heading={t("home.heading")}>
      <s-section heading={t("home.connectedTo", { shop: shopName })}>
        <s-paragraph>{t("home.runtimeBody")}</s-paragraph>
        <s-paragraph>
          {installedAt
            ? // Formatted for the merchant's locale, never a raw ISO string.
              t("home.installRecorded", {
                date: formatDateTime(locale, installedAt),
              })
            : t("home.installMissing")}
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading={t("home.stack.heading")}>
        <s-paragraph>
          <s-text>{t("home.stack.runtime")} </s-text>
          <s-link href="https://developers.cloudflare.com/workers/" target="_blank">
            Cloudflare Workers
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>{t("home.stack.framework")} </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>{t("home.stack.interface")} </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>{t("home.stack.database")} </s-text>
          <s-link href="https://developers.cloudflare.com/d1/" target="_blank">
            D1
          </s-link>
          <s-text> + Drizzle</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>{t("home.stack.sessions")} </s-text>
          <s-link href="https://developers.cloudflare.com/kv/" target="_blank">
            Workers KV
          </s-link>
        </s-paragraph>
      </s-section>

      {/*
        LAST on the page, deliberately — the lesson repair-ops recorded after
        moving its own: an ask placed above the merchant's data means every
        visit opens with the app talking about itself on the screen someone came
        to work on. At the end it costs nothing and still gets seen.

        Not dismissible: `s-banner`'s dismiss is client-side only and nothing
        persists it, so a Dismiss that reappears on the next load is a control
        that lies. It is quiet and at the bottom instead.
      */}
      <s-banner tone="info" heading={t("home.feedback.heading")}>
        <s-paragraph>{t("home.feedback.body")}</s-paragraph>
        <s-button slot="secondary-actions" href="/app/support/new">
          {t("home.feedback.action")}
        </s-button>
      </s-banner>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
