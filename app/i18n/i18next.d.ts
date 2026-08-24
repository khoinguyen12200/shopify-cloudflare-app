import type { Resources } from "./resources";
import type { DEFAULT_NAMESPACE } from "./config";

/**
 * Types `t()` against the English files, so a typo in a key or a missing
 * namespace is a build error rather than a string like "landing.headng"
 * rendered to a merchant.
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof DEFAULT_NAMESPACE;
    resources: Resources;
    returnNull: false;
  }
}
