import { Form, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "./config";

/**
 * Language switcher for the PUBLIC pages.
 *
 * A `<Form method="post">` to a resource route, not a client-side state toggle:
 * the choice has to be persisted in a cookie so the *server* renders the right
 * language on the next request. Switching only in the browser would leave the
 * SSR output in the old language and flash on every navigation.
 *
 * Not used in the embedded admin: there, Shopify owns the language and sends it
 * in the `locale` parameter. Offering a second switch there would let the app
 * disagree with the surrounding Shopify admin.
 */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const { t } = useTranslation("common");
  const [searchParams] = useSearchParams();

  return (
    <Form method="post" action="/locale" className="row">
      {/* Come back to the same page after switching. */}
      <input
        type="hidden"
        name="returnTo"
        value={
          typeof window === "undefined"
            ? "/"
            : window.location.pathname + (searchParams.size ? `?${searchParams}` : "")
        }
      />
      <label htmlFor="locale-switcher" className="visually-hidden">
        {t("language.change")}
      </label>
      <select
        id="locale-switcher"
        name="locale"
        defaultValue={current}
        className="field__input"
        style={{ minHeight: "2.25rem", width: "auto" }}
        // Submitting on change keeps it usable without JavaScript too: the
        // form still has a submit button for that case.
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {SUPPORTED_LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="btn btn--secondary">
          {t("actions.save")}
        </button>
      </noscript>
    </Form>
  );
}
