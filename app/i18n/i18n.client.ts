import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { i18nOptions } from "./options";
import { NAMESPACES } from "./config";

/**
 * Initialise i18next in the browser with the locale the server already used.
 *
 * The locale is read from `<html lang>` rather than re-detected: the server has
 * already resolved it (including Shopify's `locale` parameter), and detecting
 * again client-side could disagree and cause a hydration mismatch.
 */
export async function initClientI18n(): Promise<typeof i18next> {
  if (i18next.isInitialized) return i18next;

  const lng = document.documentElement.lang || i18nOptions.fallbackLng;

  await i18next.use(initReactI18next).init({
    ...i18nOptions,
    lng,
    ns: [...NAMESPACES],
  });

  return i18next;
}
