import { describe, it, expect } from "vitest";
import { getLocale, localeCookie } from "./i18n.server";

const url = (path: string) => `https://example.test${path}`;

describe("locale resolution order", () => {
  it("uses Shopify's `locale` parameter above everything else", async () => {
    // Apps rendered in the Shopify admin receive the merchant's chosen locale in
    // the `locale` request parameter, so it must win — even against an explicit
    // ?lng= and a cookie that say otherwise.
    const request = new Request(url("/app?locale=es&lng=en"), {
      headers: {
        Cookie: await localeCookie.serialize("en"),
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    expect(await getLocale(request)).toBe("es");
  });

  it("accepts a regional tag from Shopify", async () => {
    const request = new Request(url("/app?locale=es-ES"));
    expect(await getLocale(request)).toBe("es");
  });

  it("ignores an unsupported Shopify locale rather than breaking", async () => {
    const request = new Request(url("/app?locale=de-DE"));
    expect(await getLocale(request)).toBe("en");
  });

  it("uses ?lng= on the public pages", async () => {
    const request = new Request(url("/pricing?lng=es"));
    expect(await getLocale(request)).toBe("es");
  });

  it("uses the cookie when no parameter is present", async () => {
    const request = new Request(url("/pricing"), {
      headers: { Cookie: await localeCookie.serialize("es") },
    });
    expect(await getLocale(request)).toBe("es");
  });

  it("prefers ?lng= over the cookie", async () => {
    const request = new Request(url("/pricing?lng=en"), {
      headers: { Cookie: await localeCookie.serialize("es") },
    });
    expect(await getLocale(request)).toBe("en");
  });

  it("falls back to Accept-Language", async () => {
    const request = new Request(url("/"), {
      headers: { "Accept-Language": "es-ES,es;q=0.9,en;q=0.5" },
    });
    expect(await getLocale(request)).toBe("es");
  });

  it("falls back to en with no signal at all", async () => {
    expect(await getLocale(new Request(url("/")))).toBe("en");
  });

  it("falls back to en when Accept-Language asks for something unsupported", async () => {
    const request = new Request(url("/"), {
      headers: { "Accept-Language": "de-DE,de;q=0.9" },
    });
    expect(await getLocale(request)).toBe("en");
  });
});
