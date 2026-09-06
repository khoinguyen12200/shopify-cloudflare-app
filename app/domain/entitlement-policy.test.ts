import { describe, expect, it } from "vitest";
import * as policy from "./entitlement-policy";

describe("entitlement policy contract", () => {
  it("exports the pure resolver", () => {
    expect(policy).toHaveProperty("resolveEntitlement");
  });
});
