import type { EntitlementCatalogue } from "~/domain/entitlement-policy";
import { PLANS } from "~/billing/plans";

export const ENTITLEMENT_CATALOGUE: EntitlementCatalogue = {
  version: 1,
  freePlan: "free",
  features: {
    "reports.export": { kind: "capability" },
    "staff.max": { kind: "capacity" },
    "documents.monthly": { kind: "quota", period: "calendar_month" },
  },
  plans: {
    free: {
      "reports.export": { kind: "enabled" },
      "staff.max": { kind: "limit", maximum: 1 },
      "documents.monthly": { kind: "limit", maximum: 10 },
    },
    pro: {
      "reports.export": { kind: "enabled" },
      "staff.max": { kind: "limit", maximum: 10 },
      "documents.monthly": { kind: "limit", maximum: 1000 },
    },
  },
};

export const DISPLAY_PLANS = PLANS;
