import { describe, expect, it } from "vitest";
import { canUsePlanFeature } from "./entitlement-gate";

describe("canUsePlanFeature", () => {
  it("allows a feature when the current handle is included", () => {
    expect(canUsePlanFeature({ status: "ACTIVE", planHandle: "pro" }, "pro")).toBe(true);
  });

  it("denies canceled, frozen, unknown, and missing plans", () => {
    for (const status of ["CANCELED", "FROZEN", "UNKNOWN", "NONE"] as const) {
      expect(canUsePlanFeature({ status, planHandle: status === "NONE" ? null : "pro" }, "pro")).toBe(false);
    }
  });
});
