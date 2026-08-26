import { describe, it, expect } from "vitest";
import { MODEL_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, isModelRole } from "./roles";

describe("model roles", () => {
  it("narrows a known role and rejects anything else", () => {
    expect(isModelRole("writing")).toBe(true);
    expect(isModelRole("summary")).toBe(true);
    // Comes off a form, so this is the guard that matters.
    expect(isModelRole("reasoning")).toBe(false);
    expect(isModelRole("")).toBe(false);
    expect(isModelRole("__proto__")).toBe(false);
  });

  it("labels and describes every role", () => {
    for (const role of MODEL_ROLES) {
      expect(ROLE_LABEL[role].length, role).toBeGreaterThan(0);
      expect(ROLE_DESCRIPTION[role].length, role).toBeGreaterThan(0);
    }
  });
});
