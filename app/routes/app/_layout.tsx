import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const env = getEnv();
  await createShopify(env).authenticate.admin(request);

  // The public client_id, read from the Worker's env binding — there is no
  // process.env in workerd.
  return { apiKey: env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  // v2's AppProvider takes only `children` + `apiKey` — the v1 `embedded` prop
  // is gone, and the provider always loads App Bridge + Polaris web components.
  return (
    <AppProvider apiKey={apiKey}>
      <NavMenu>
        {/* App Bridge requires the first child to be the app-root link. */}
        <a href="/app" rel="home">
          Home
        </a>
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
