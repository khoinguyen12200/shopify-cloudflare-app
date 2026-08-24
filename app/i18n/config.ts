/**
 * i18n configuration. Pure — no I/O, no framework, importable from anywhere.
 *
 * Adding a locale is three steps: add it here, add the JSON files under
 * `locales/<code>/`, and register them in `resources.ts`. TypeScript then fails
 * the build until the new files carry every key `en` has.
 */

/** Every locale the app ships. `en` first: it is the fallback and the key source. */
export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/**
 * Namespaces split by surface, so the embedded admin bundle does not ship
 * marketing and legal copy (and vice versa).
 *   common   — used everywhere
 *   public   — landing, pricing, legal, support
 *   admin    — the embedded Shopify admin (merchant-facing)
 *   internal — the staff console at /internal
 */
export const NAMESPACES = ["common", "public", "admin", "internal"] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const DEFAULT_NAMESPACE: Namespace = "common";

/** Human names for the language switcher, each written in its own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

/**
 * Writing direction. All current locales are LTR, but `<html dir>` is set from
 * this so adding an RTL locale is a one-line change, not a hunt through markup.
 */
export const LOCALE_DIRECTION: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  es: "ltr",
};

/** Narrow an untrusted string (query param, cookie, header) to a Locale. */
export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Coerce anything to a supported locale.
 *
 * Shopify sends regional tags in the admin's `locale` parameter (`es-ES`,
 * `pt-BR`), so match the base language before giving up — otherwise a Spanish
 * merchant silently gets English.
 */
export function toLocale(value: unknown): Locale {
  if (isSupportedLocale(value)) return value;
  if (typeof value === "string") {
    const base = value.split("-")[0]?.toLowerCase();
    if (isSupportedLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
