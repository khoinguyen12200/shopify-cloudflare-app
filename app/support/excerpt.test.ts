import { describe, it, expect } from "vitest";
import { excerpt, EXCERPT_MAX } from "./excerpt";

describe("excerpt", () => {
  it("returns a short message unchanged", () => {
    expect(excerpt("It stopped working.")).toBe("It stopped working.");
  });

  it("collapses newlines and runs of whitespace into single spaces", () => {
    // A notification preview is one line; a pasted stack trace must not
    // become forty blank ones.
    expect(excerpt("line one\n\n   line two\ttab")).toBe("line one line two tab");
  });

  it("trims the edges", () => {
    expect(excerpt("  padded  ")).toBe("padded");
  });

  it("truncates over the limit and marks the cut with an ellipsis", () => {
    const long = "a".repeat(EXCERPT_MAX + 50);
    const result = excerpt(long);
    expect(result).toHaveLength(EXCERPT_MAX);
    expect(result.endsWith("…")).toBe(true);
  });

  it("keeps a message exactly at the limit whole", () => {
    const exact = "a".repeat(EXCERPT_MAX);
    expect(excerpt(exact)).toBe(exact);
  });

  it("returns a placeholder when the message is only an attachment", () => {
    // A reply can legitimately be a screenshot with no words, and an empty
    // preview line reads as a broken email.
    expect(excerpt("")).toBe("(no message)");
    expect(excerpt("   \n  ")).toBe("(no message)");
  });
});
