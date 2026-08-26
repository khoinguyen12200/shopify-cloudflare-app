import { describe, it, expect } from "vitest";
import { isProductionLike } from "./deployment";

describe("deciding whether this is a real deployment", () => {
  it("says yes for an https app URL", () => {
    expect(isProductionLike("https://app.example.com")).toBe(true);
  });

  it("says no for a plain-http local URL", () => {
    expect(isProductionLike("http://localhost:8788")).toBe(false);
  });

  it("says no when the URL is missing entirely", () => {
    // The gate unlocks development conveniences, so an unknown environment must
    // fail CLOSED — treating it as production is the safe direction.
    expect(isProductionLike("")).toBe(false);
  });

  it("is not fooled by 'https' appearing later in the string", () => {
    expect(isProductionLike("http://local/redirect?to=https://real")).toBe(false);
  });
});
