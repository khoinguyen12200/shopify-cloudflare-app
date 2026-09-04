import { describe, expect, it } from "vitest";
import { compliancePayloadSchema } from "./compliance-webhook";
import { currentAppInstallationSchema } from "./current-app-installation";

describe("external payload schemas", () => {
  it("rejects primitive and array compliance payloads", () => {
    expect(compliancePayloadSchema.safeParse("payload").success).toBe(false);
    expect(compliancePayloadSchema.safeParse([]).success).toBe(false);
  });

  it("requires the Shopify app handle in the GraphQL response", () => {
    expect(
      currentAppInstallationSchema.safeParse({
        data: { currentAppInstallation: { app: {} } },
      }).success,
    ).toBe(false);
  });
});
