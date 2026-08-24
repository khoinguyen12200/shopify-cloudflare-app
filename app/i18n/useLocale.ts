import { useTranslation } from "react-i18next";
import { toLocale, type Locale } from "./config";

/**
 * The locale the current render is using.
 *
 * Read from i18next rather than from the root loader: i18next is what is
 * actually producing the strings on screen, so a date formatted with this can
 * never disagree with the text beside it. It also keeps components free of a
 * dependency on a specific route id, which made them impossible to render in
 * isolation.
 */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return toLocale(i18n.resolvedLanguage ?? i18n.language);
}
