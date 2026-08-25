import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { loginErrorKey } from "./login-error.server";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const env = getEnv();
  const errorKey = loginErrorKey(await createShopify(env).login(request));

  // v2's AppProvider requires apiKey (it always loads App Bridge + Polaris web
  // components), so this non-embedded page has to pass it through too.
  return { errorKey, apiKey: env.SHOPIFY_API_KEY || "" };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const env = getEnv();
  const errorKey = loginErrorKey(await createShopify(env).login(request));

  return { errorKey, apiKey: env.SHOPIFY_API_KEY || "" };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const { t } = useTranslation("admin");
  const [shop, setShop] = useState("");
  const { errorKey, apiKey } = actionData || loaderData;
  const shopError = errorKey ? t(`login.errors.${errorKey}`) : undefined;

  return (
    <AppProvider apiKey={apiKey}>
      <s-page>
        <Form method="post">
          <s-section heading={t("login.heading")}>
            <s-text-field
              name="shop"
              label={t("login.shopDomain")}
              details={t("login.shopDomainHint")}
              value={shop}
              onChange={(e) => setShop(e.currentTarget.value)}
              autocomplete="on"
              error={shopError}
            ></s-text-field>
            <s-button type="submit">{t("login.submit")}</s-button>
          </s-section>
        </Form>
      </s-page>
    </AppProvider>
  );
}
