import { describe, it, expect } from "vitest";
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { loginErrorKey } from "./login-error.server";

describe("loginErrorKey", () => {
  it("maps a missing shop to the missingShop key", () => {
    expect(loginErrorKey({ shop: LoginErrorType.MissingShop })).toBe(
      "missingShop",
    );
  });

  it("maps an invalid shop to the invalidShop key", () => {
    expect(loginErrorKey({ shop: LoginErrorType.InvalidShop })).toBe(
      "invalidShop",
    );
  });

  it("returns undefined when there is no error", () => {
    expect(loginErrorKey(undefined)).toBeUndefined();
  });
});
