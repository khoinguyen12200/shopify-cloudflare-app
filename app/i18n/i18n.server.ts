import { createCookie } from "react-router";
import { RemixI18Next } from "remix-i18next/server";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  toLocale,
  type Locale,
} from "./config";
import { i18nOptions } from "./options";

/**
 * Cookie holding the visitor's chosen language on the PUBLIC pages.
 *
 * Not `httpOnly`: the language switcher is allowed to be a plain link, and there
 * is nothing secret in a language choice. One year, because a preference that
 * expires is worse than no preference.
 */
export const localeCookie = createCookie("locale", {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  maxAge: 60 * 60 * 24 * 365,
});

/**
 * Where the locale comes from, highest priority first:
 *
 *  1. `?locale=` — SHOPIFY'S OWN PARAMETER. Apps rendered in the Shopify admin
 *     receive the merchant's chosen locale in the `locale` request parameter, so
 *     inside the embedded app this is authoritative: the merchant already picked
 *     a language in Shopify and the app must match it, not second-guess it.
 *     https://shopify.dev/docs/apps/build/localize-your-app
 *  2. `?lng=` — an explicit switch on the public pages.
 *  3. Cookie — the visitor's remembered public choice.
 *  4. `Accept-Language` — a sensible first guess.
 *  5. `en`.
 *
 * Shopify sends regional tags (`es-ES`), so `toLocale` matches the base language
 * before falling back.
 */
async function findLocale(request: Request): Promise<string | null> {
  const shopifyLocale = new URL(request.url).searchParams.get("locale");
  if (!shopifyLocale) return null;
  return toLocale(shopifyLocale);
}

/**
 * Holds only immutable configuration — no per-request or per-shop state — so a
 * module-level constant is safe in a reused isolate. It creates a fresh i18next
 * instance per call; nothing is shared between requests.
 */
export const i18nServer = new RemixI18Next({
  detection: {
    supportedLanguages: [...SUPPORTED_LOCALES],
    fallbackLanguage: DEFAULT_LOCALE,
    cookie: localeCookie,
    searchParamKey: "lng",
    order: ["custom", "searchParams", "cookie", "header"],
    findLocale,
  },
  i18next: i18nOptions,
});

/** The resolved locale for this request, narrowed to a supported one. */
export async function getLocale(request: Request): Promise<Locale> {
  return toLocale(await i18nServer.getLocale(request));
}
