import { describe, expect, it } from "vitest";
import { PLAN_CARD_CSS } from "./PlanCard";

describe("PlanCard styles", () => {
  it("removes the browser's left padding from plan feature lists", () => {
    expect(PLAN_CARD_CSS).toMatch(/\.bp-features\s*\{[^}]*padding-inline-start:\s*0;/s);
  });
});
