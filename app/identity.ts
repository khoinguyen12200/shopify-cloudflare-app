import type { Locale } from "~/i18n/config";

/**
 * Stable product identity shared by public pages, legal copy, and notifications.
 * Keep this module pure: values are configured at authoring time, never per
 * request or from a runtime environment.
 */
export const identity = Object.freeze({
  name: "TODO: Your App Name",
  brandName: "TODO: Your App Name",
  companyName: "TODO: Your Legal Entity Name",
  contacts: Object.freeze({
    supportEmail: "TODO: support@example.com",
    privacyEmail: "TODO: privacy@example.com",
  }),
  legal: Object.freeze({
    address: "TODO: Street, City, Region, Postcode, Country",
    effectiveDate: "TODO: YYYY-MM-DD",
  }),
  copy: Object.freeze({
    tagline: Object.freeze({
      en: "TODO: Your localized product tagline",
      es: "TODO: El eslogan localizado de tu producto",
    }),
    emailSenderDisclosure: Object.freeze({
      en: "This email was sent by TODO: Your App Name support.",
      es: "Este correo fue enviado por el soporte de TODO: Your App Name.",
    }),
  }),
} as const);

export function emailSenderDisclosure(locale: Locale): string {
  return identity.copy.emailSenderDisclosure[locale];
}
