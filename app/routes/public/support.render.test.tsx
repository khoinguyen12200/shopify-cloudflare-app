import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import Support from "./support";
import { i18nOptions } from "~/i18n/options";
import { identity } from "~/identity";

describe("support contact identity", () => {
  it("renders the support contact rather than the privacy contact", async () => {
    const instance = createInstance();
    await instance.use(initReactI18next).init({ ...i18nOptions, lng: "en" });
    const html = renderToString(
      <I18nextProvider i18n={instance}>
        <Support />
      </I18nextProvider>,
    );

    expect(html).toContain(identity.contacts.supportEmail);
    expect(html).not.toContain(identity.contacts.privacyEmail);
  });
});
