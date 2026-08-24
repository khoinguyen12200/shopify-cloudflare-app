import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { ShopRepo } from "~/models/shops.server";

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

  return (
    <s-page heading="Shopify + Cloudflare scaffold">
      <s-section heading={`Connected to ${shopName}`}>
        <s-paragraph>
          This app runs in the Cloudflare Workers runtime. Sessions live in KV,
          app state lives in D1 via Drizzle, and both are real bindings in
          local dev (Miniflare) as well as production.
        </s-paragraph>
        <s-paragraph>
          {installedAt
            ? `Install recorded in D1 at ${new Date(installedAt).toISOString()}.`
            : "No install row in D1 yet — it is written when OAuth completes."}
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Stack">
        <s-paragraph>
          <s-text>Runtime: </s-text>
          <s-link href="https://developers.cloudflare.com/workers/" target="_blank">
            Cloudflare Workers
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Framework: </s-text>
          <s-link href="https://reactrouter.com/" target="_blank">
            React Router
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Interface: </s-text>
          <s-link
            href="https://shopify.dev/docs/api/app-home/using-polaris-components"
            target="_blank"
          >
            Polaris web components
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text>Database: </s-text>
          <s-link href="https://developers.cloudflare.com/d1/" target="_blank">
            D1
          </s-link>
          <s-text> + Drizzle</s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text>Sessions: </s-text>
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
