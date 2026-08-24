import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { ShopRepo } from "~/models/shops.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDateTime } from "~/i18n/format";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } =
    await createShopify(getEnv()).authenticate.admin(request);

  // A read-only Admin GraphQL call, to prove the client is wired end to end.
  const response = await admin.graphql(
    `#graphql
      query ScaffoldShop {
        shop {
          name
          myshopifyDomain
        }
      }`,
  );
  const body = await response.json();

  // A D1 read through the models layer, to prove that half is wired too.
  const record = await new ShopRepo().get(session.shop);

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
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
