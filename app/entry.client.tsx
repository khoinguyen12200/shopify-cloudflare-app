import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { I18nextProvider } from "react-i18next";
import { initClientI18n } from "~/i18n/i18n.client";

/**
 * Custom client entry: i18next must be initialised BEFORE hydration, or the
 * first client render has no translations and React reports a mismatch against
 * the server HTML.
 */
async function hydrate() {
  const i18n = await initClientI18n();

  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <HydratedRouter />
        </I18nextProvider>
      </StrictMode>,
    );
  });
}

hydrate().catch((error: unknown) => {
  // Never swallow this: a failed hydration leaves a dead page, and the console
  // is the only place it can be seen.
  console.error("Client hydration failed", error);
});
