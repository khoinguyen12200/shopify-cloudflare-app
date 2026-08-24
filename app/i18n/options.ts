import type { InitOptions } from "i18next";
import {
  DEFAULT_LOCALE,
  DEFAULT_NAMESPACE,
  NAMESPACES,
  SUPPORTED_LOCALES,
} from "./config";
import { resources } from "./resources";

/**
 * i18next options shared by the server and the browser, so the two can never
 * drift into rendering different text for the same locale (which React would
 * report as a hydration mismatch).
 */
export const i18nOptions = {
  supportedLngs: [...SUPPORTED_LOCALES],
  fallbackLng: DEFAULT_LOCALE,
  defaultNS: DEFAULT_NAMESPACE,
  ns: [...NAMESPACES],
  resources,
  // React already escapes interpolated values; letting i18next escape them too
  // double-encodes apostrophes and accents — visible in Spanish immediately.
  interpolation: { escapeValue: false },
  returnNull: false,
} satisfies InitOptions;
