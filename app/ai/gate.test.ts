import { describe, it, expect } from "vitest";
import { aiRefusal, AI_PLAN_ACCESS } from "./gate";
import { MODEL_ROLES } from "./roles";

describe("who may use AI", () => {
  it("always allows staff, whatever the shop's plan", () => {
    // The internal console is our own tooling on our own bill. Gating it behind
    // a merchant's plan would let their downgrade break our support desk.
    expect(aiRefusal({ surface: "staff", plan: "free", role: "writing" })).toBeNull();
    expect(aiRefusal({ surface: "staff", plan: null, role: "writing" })).toBeNull();
  });

  it("allows a merchant on a plan that includes AI", () => {
    expect(aiRefusal({ surface: "merchant", plan: "pro", role: "writing" })).toBeNull();
  });

  it("refuses a merchant on a plan that does not", () => {
    expect(aiRefusal({ surface: "merchant", plan: "free", role: "writing" })).toBe("forbidden");
  });

  it("refuses a merchant whose plan we could not determine", () => {
    // Fails CLOSED. An unknown plan is not a licence to spend our tokens.
    expect(aiRefusal({ surface: "merchant", plan: null, role: "writing" })).toBe("forbidden");
  });

  it("allows system work, which nobody is charged for", () => {
    expect(aiRefusal({ surface: "system", plan: null, role: "summary" })).toBeNull();
  });

  it("decides the same way for every purpose today", () => {
    // Per-purpose gating is not a policy we have, but the signature carries the
    // role so adding one later is a change to this table and nothing else.
    for (const role of MODEL_ROLES) {
      expect(aiRefusal({ surface: "merchant", plan: "free", role }), role).toBe("forbidden");
      expect(aiRefusal({ surface: "merchant", plan: "pro", role }), role).toBeNull();
    }
  });

  it("names every plan, so a new plan cannot silently get AI", () => {
    // `Record<PlanKey, boolean>` — adding a plan stops this compiling until
    // someone decides whether it includes AI.
    expect(Object.keys(AI_PLAN_ACCESS).sort()).toEqual(["free", "pro"]);
  });
});
