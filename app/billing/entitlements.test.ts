import { describe, expect, it } from "vitest";
import { entitlementFor } from "./entitlements";

describe("entitlementFor", () => {
  it("resolves a feature without callers knowing the plan handle", () => {
    expect(entitlementFor("pro", "projects.max")).toEqual({ kind: "limit", maximum: 10 });
  });

  it("fails closed for an unknown plan or key", () => {
    expect(entitlementFor("unknown", "projects.max")).toEqual({ kind: "disabled" });
    expect(entitlementFor("free", "missing")).toEqual({ kind: "disabled" });
  });

  it("does not expose a numeric grant for a prototype property", () => {
    expect(entitlementFor("pro", "constructor")).toEqual({ kind: "disabled" });
  });
});
