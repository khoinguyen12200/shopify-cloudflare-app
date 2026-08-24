import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { palette } from "./tokens";

/**
 * Email cannot use SCSS: clients strip `<style>` blocks and ignore external
 * stylesheets and custom properties, so every rule must be an inline attribute.
 * `tokens.ts` therefore holds literal hex values.
 *
 * That leaves two palettes which agree on the day they are written and never
 * again — unless something checks. This is that something: it reads the SCSS
 * light palette and fails when an email colour no longer matches the site's.
 *
 * Change a colour in `_tokens.scss` and this test tells you the email is stale.
 */
function scssLightPalette(): Record<string, string> {
  // The light palette is the first `@mixin light-palette { … }` block.
  const block = /@mixin\s+light-palette\s*\{([\s\S]*?)\n\}/.exec(
    env.TEST_PUBLIC_TOKENS_SCSS,
  );
  if (!block) throw new Error("Could not find the light-palette mixin in _tokens.scss");

  const values: Record<string, string> = {};
  for (const line of block[1]!.split("\n")) {
    const declaration = /^\s*(--[\w-]+)\s*:\s*([^;]+);/.exec(line);
    if (declaration) values[declaration[1]!] = declaration[2]!.trim().toLowerCase();
  }
  return values;
}

/** email token → the SCSS custom property it mirrors. */
const MIRRORS: Record<keyof typeof palette, string> = {
  page: "--color-bg-subtle",
  card: "--color-surface",
  text: "--color-text",
  muted: "--color-text-muted",
  line: "--color-border",
  accent: "--color-accent",
  accentText: "--color-accent-text",
};

describe("email tokens mirror the public SCSS palette", () => {
  const scss = scssLightPalette();

  it("finds the SCSS light palette", () => {
    // If this fails the parser is broken, and every assertion below is vacuous.
    expect(Object.keys(scss).length).toBeGreaterThan(10);
  });

  it.each(Object.entries(MIRRORS))(
    "palette.%s matches %s",
    (token, property) => {
      const expected = scss[property];
      expect(expected, `${property} is missing from _tokens.scss`).toBeDefined();
      expect(palette[token as keyof typeof palette].toLowerCase()).toBe(expected);
    },
  );

  it("mirrors every email token, so none can drift unwatched", () => {
    expect(Object.keys(MIRRORS).sort()).toEqual(Object.keys(palette).sort());
  });
});
