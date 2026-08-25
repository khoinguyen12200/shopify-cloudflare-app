import { describe, it, expect } from "vitest";
import { RouterContextProvider } from "react-router";
import { action } from "./locale";
import { getLocale } from "~/i18n/i18n.server";

const LOCALE_URL = "https://example.test/locale";

const post = (form: Record<string, string>) => {
  const body = new FormData();
  for (const [key, value] of Object.entries(form)) body.append(key, value);
  return new Request(LOCALE_URL, { method: "POST", body });
};

/** The action's contract: only ever a redirect carrying the cookie. */
async function submit(form: Record<string, string>): Promise<Response> {
  // The route is action-only, so nothing here needs a router or a render.
  return (await action({
    request: post(form),
    params: {},
    context: new RouterContextProvider(),
    url: new URL(LOCALE_URL),
    pattern: "/locale",
  })) as unknown as Response;
}

describe("switching language", () => {
  it("sets a cookie that the next request actually resolves to the new locale", async () => {
    // The whole point of the switcher: the SERVER has to render the new
    // language on the next request, not just the browser.
    const response = await submit({ locale: "es", returnTo: "/pricing" });
    const cookie = response.headers.get("Set-Cookie");
    expect(cookie).toBeTruthy();

    const next = new Request("https://example.test/pricing", {
      headers: { Cookie: cookie ?? "" },
    });
    expect(await getLocale(next)).toBe("es");
  });

  it("returns the visitor to the page they switched from", async () => {
    const response = await submit({ locale: "es", returnTo: "/pricing" });
    expect(response.headers.get("Location")).toBe("/pricing");
  });

  it("keeps the query string of the page they switched from", async () => {
    const response = await submit({ locale: "es", returnTo: "/support?topic=billing" });
    expect(response.headers.get("Location")).toBe("/support?topic=billing");
  });

  it("refuses an absolute URL as the return path", async () => {
    // An open redirect: the form field is attacker-controllable.
    const response = await submit({ locale: "es", returnTo: "https://evil.test/x" });
    expect(response.headers.get("Location")).toBe("/");
  });

  it("refuses a protocol-relative URL as the return path", async () => {
    const response = await submit({ locale: "es", returnTo: "//evil.test/x" });
    expect(response.headers.get("Location")).toBe("/");
  });

  it("falls back to the default locale for an unsupported choice", async () => {
    const response = await submit({ locale: "zz", returnTo: "/" });
    const next = new Request("https://example.test/", {
      headers: { Cookie: response.headers.get("Set-Cookie") ?? "" },
    });
    expect(await getLocale(next)).toBe("en");
  });
});
