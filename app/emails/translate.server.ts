import { i18nServer } from "~/i18n/i18n.server";
import { toLocale } from "~/i18n/config";
import type { TFunction } from "i18next";

/**
 * A translator for one email, in the recipient's language.
 *
 * Mail is rendered outside any route, so there is no `useTranslation` and no
 * request to detect from — the locale travels on the payload instead, captured
 * when the recipient was last in front of us.
 *
 * `toLocale` narrows first: Shopify sends regional tags like `es-ES`, and a
 * strict lookup on one would silently fall back to English for a Spanish
 * merchant (@rules/i18n.md). An absent locale is the app default, which is the
 * honest answer for a ticket opened before we recorded one.
 */
export function emailT(locale: string | undefined): Promise<TFunction<"email">> {
  return i18nServer.getFixedT(toLocale(locale ?? ""), "email");
}
