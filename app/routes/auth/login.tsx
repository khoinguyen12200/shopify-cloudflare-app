import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { loginErrorMessage } from "./login-error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const env = getEnv();
  const errors = loginErrorMessage(await createShopify(env).login(request));

  // v2's AppProvider requires apiKey (it always loads App Bridge + Polaris web
  // components), so this non-embedded page has to pass it through too.
  return { errors, apiKey: env.SHOPIFY_API_KEY || "" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const env = getEnv();
  const errors = loginErrorMessage(await createShopify(env).login(request));

  return { errors, apiKey: env.SHOPIFY_API_KEY || "" };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const { errors, apiKey } = actionData || loaderData;

  return (
    <AppProvider apiKey={apiKey}>
      <s-page>
        <Form method="post">
          <s-section heading="Log in">
            <s-text-field
              name="shop"
              label="Shop domain"
              details="example.myshopify.com"
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={errors.shop}
            ></s-text-field>
            <s-button type="submit">Log in</s-button>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
