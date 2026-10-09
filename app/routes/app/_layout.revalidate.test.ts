import { describe, expect, it } from "vitest";
import type { ShouldRevalidateFunctionArgs } from "react-router";
import { shouldRevalidate } from "./_layout";

function args(overrides: Partial<ShouldRevalidateFunctionArgs>): ShouldRevalidateFunctionArgs {
  return {
    currentUrl: new URL("https://example.test/app"),
    currentParams: {},
    nextUrl: new URL("https://example.test/app/billing"),
    nextParams: {},
    defaultShouldRevalidate: true,
    ...overrides,
  };
}

describe("the /app layout revalidation", () => {
  it("does not re-run the shell loader on a client navigation between pages", () => {
    expect(shouldRevalidate(args({}))).toBe(false);
  });

  it("does not re-run it when only the query string changes", () => {
    expect(shouldRevalidate(args({ nextUrl: new URL("https://example.test/app?locale=de") }))).toBe(false);
  });

  it("follows the router default after a mutation, so the shell refreshes with the data", () => {
    expect(shouldRevalidate(args({ formMethod: "POST", defaultShouldRevalidate: true }))).toBe(true);
    expect(shouldRevalidate(args({ formMethod: "POST", defaultShouldRevalidate: false }))).toBe(false);
  });
});
