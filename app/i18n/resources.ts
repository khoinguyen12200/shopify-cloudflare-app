// Static imports, NOT a filesystem or HTTP backend.
//
// workerd has no filesystem, so i18next-fs-backend cannot work, and an HTTP
// backend would add a network round-trip to every cold render. Importing the
// JSON bundles it, which is both faster and the only option that works here.
//
// Vite code-splits per namespace, so the admin chunk does not carry the
// marketing and legal copy.
import enCommon from "./locales/en/common.json";
import enPublic from "./locales/en/public.json";
import enAdmin from "./locales/en/admin.json";
import esCommon from "./locales/es/common.json";
import esPublic from "./locales/es/public.json";
import esAdmin from "./locales/es/admin.json";

import type { Locale, Namespace } from "./config";

export const resources: Record<Locale, Record<Namespace, object>> = {
  en: { common: enCommon, public: enPublic, admin: enAdmin },
  es: { common: esCommon, public: esPublic, admin: esAdmin },
};

/** `en` is the key source: every other locale is type-checked against it. */
export type Resources = {
  common: typeof enCommon;
  public: typeof enPublic;
  admin: typeof enAdmin;
};
