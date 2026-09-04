import { describe, expect, it } from "vitest";
import * as appLayout from "./app/_layout";
import { links as publicLinks } from "./public/_layout";

describe("surface asset ownership", () => {
  it("loads the public stylesheet only from the public layout", () => {
    const links = publicLinks();
    const serialized = JSON.stringify(links);

    expect(links).toHaveLength(1);
    expect(serialized).toContain('"rel":"stylesheet"');
    expect(serialized).not.toContain("cdn.shopify.com");
    expect(serialized).not.toContain("fonts.googleapis.com");
  });

  it("does not add font or stylesheet links to the embedded app layout", () => {
    const links =
      "links" in appLayout && typeof appLayout.links === "function"
        ? appLayout.links()
        : [];

    expect(links).toHaveLength(0);
  });
});
