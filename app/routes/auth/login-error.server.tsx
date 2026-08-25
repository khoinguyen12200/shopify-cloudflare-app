import type { LoginError } from "@shopify/shopify-app-react-router/server";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";

/** Keyed under `admin:login.errors.*` — the route translates it, not this. */
export type LoginErrorKey = "missingShop" | "invalidShop";

export function loginErrorKey(
  loginErrors: LoginError | undefined,
): LoginErrorKey | undefined {
  if (loginErrors?.shop === LoginErrorType.MissingShop) return "missingShop";
  if (loginErrors?.shop === LoginErrorType.InvalidShop) return "invalidShop";
  return undefined;
}
