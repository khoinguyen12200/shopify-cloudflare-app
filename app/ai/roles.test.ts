import { describe, it, expect } from "vitest";
import { MODEL_ROLES, ROLES_IN_USE, ROLE_DESCRIPTION, ROLE_LABEL, isModelRole } from "./roles";

describe("model roles", () => {
  it("narrows a known role and rejects anything else", () => {
    for (const role of MODEL_ROLES) expect(isModelRole(role), role).toBe(true);
    // Comes off a form, so this is the guard that matters.
    expect(isModelRole("")).toBe(false);
    expect(isModelRole("chat")).toBe(false);
    expect(isModelRole("__proto__")).toBe(false);
  });

  it("says which purposes a shipped feature actually uses", () => {
    // Some purposes are configurable before a feature needs them. The console
    // marks which, so nobody mistakes a configured purpose for a running one.
    const inUse = MODEL_ROLES.filter((role) => ROLES_IN_USE[role] !== null);
    expect(inUse).toContain("writing");
    expect(inUse).toContain("summary");
    expect(inUse.length).toBeLessThan(MODEL_ROLES.length);
  });

  it("labels and describes every role", () => {
    for (const role of MODEL_ROLES) {
      expect(ROLE_LABEL[role].length, role).toBeGreaterThan(0);
      expect(ROLE_DESCRIPTION[role].length, role).toBeGreaterThan(0);
    }
  });
});
