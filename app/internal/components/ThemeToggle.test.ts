import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, THEME_KEY } from "./ThemeToggle";

/** Run the init script against a minimal fake browser and report whether `dark` ended up on <html>. */
function run(options: { stored: string | "throws" | null; prefersDark: boolean }): boolean {
  let dark = false;
  const localStorage = {
    getItem(key: string): string | null {
      if (options.stored === "throws") throw new Error("storage blocked");
      return key === THEME_KEY ? options.stored : null;
    },
  };
  const window = { matchMedia: () => ({ matches: options.prefersDark }) };
  const document = {
    documentElement: {
      classList: { toggle: (_name: string, force: boolean) => { dark = force; } },
    },
  };
  new Function("localStorage", "window", "document", THEME_INIT_SCRIPT)(localStorage, window, document);
  return dark;
}

describe("THEME_INIT_SCRIPT", () => {
  it("honours a stored choice over the OS preference", () => {
    expect(run({ stored: "dark", prefersDark: false })).toBe(true);
    expect(run({ stored: "light", prefersDark: true })).toBe(false);
  });

  it("follows the OS preference when nothing is stored", () => {
    expect(run({ stored: null, prefersDark: true })).toBe(true);
    expect(run({ stored: null, prefersDark: false })).toBe(false);
  });

  it("falls back to the OS preference when storage is blocked", () => {
    expect(run({ stored: "throws", prefersDark: true })).toBe(true);
    expect(run({ stored: "throws", prefersDark: false })).toBe(false);
  });

  it("has no empty catch block", () => {
    expect(THEME_INIT_SCRIPT).not.toMatch(/catch\s*\([^)]*\)\s*\{\s*\}/);
  });
});
