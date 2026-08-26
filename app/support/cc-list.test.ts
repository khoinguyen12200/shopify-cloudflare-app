import { describe, it, expect } from "vitest";
import { addCcEmail, removeCcEmail, sameCcList, CC_MAX } from "./cc-list";

describe("adding a CC address", () => {
  it("appends a valid address", () => {
    const result = addCcEmail([], "dev@example.org");
    expect(result).toEqual({ ok: true, value: ["dev@example.org"] });
  });

  it("normalises case and surrounding whitespace", () => {
    // The merchant pastes from a mail client, which keeps the display casing.
    const result = addCcEmail([], "  Dev@Example.ORG  ");
    expect(result).toEqual({ ok: true, value: ["dev@example.org"] });
  });

  it("keeps the existing addresses, in order", () => {
    const result = addCcEmail(["a@example.org"], "b@example.org");
    expect(result).toEqual({ ok: true, value: ["a@example.org", "b@example.org"] });
  });

  it("refuses an address that is not an email", () => {
    expect(addCcEmail([], "not-an-email")).toEqual({
      ok: false,
      reason: "invalid_cc_email",
    });
  });

  it("refuses an empty entry", () => {
    expect(addCcEmail([], "   ")).toEqual({ ok: false, reason: "invalid_cc_email" });
  });

  it("refuses one already on the list, compared after normalising", () => {
    expect(addCcEmail(["dev@example.org"], "DEV@example.org")).toEqual({
      ok: false,
      reason: "duplicate_cc_email",
    });
  });

  it("refuses to exceed the cap", () => {
    // Every CC is an outbound send on every reply, so the cap is a real limit
    // and the modal has to be able to say so.
    const full = Array.from({ length: CC_MAX }, (_, i) => `p${i}@example.org`);
    expect(addCcEmail(full, "one-more@example.org")).toEqual({
      ok: false,
      reason: "too_many_cc_emails",
    });
  });

  it("accepts an address that fills the last free slot", () => {
    const nearlyFull = Array.from({ length: CC_MAX - 1 }, (_, i) => `p${i}@example.org`);
    const result = addCcEmail(nearlyFull, "last@example.org");
    expect(result.ok).toBe(true);
  });
});

describe("removing a CC address", () => {
  it("drops the named address and leaves the rest in order", () => {
    expect(removeCcEmail(["a@example.org", "b@example.org", "c@example.org"], "b@example.org"))
      .toEqual(["a@example.org", "c@example.org"]);
  });

  it("is a no-op for an address that is not on the list", () => {
    expect(removeCcEmail(["a@example.org"], "z@example.org")).toEqual(["a@example.org"]);
  });
});

describe("deciding whether a CC list has changed", () => {
  it("says an identical list is unchanged", () => {
    expect(sameCcList(["a@example.org"], ["a@example.org"])).toBe(true);
  });

  it("says two empty lists are unchanged", () => {
    expect(sameCcList([], [])).toBe(true);
  });

  it("sees an added address as a change", () => {
    expect(sameCcList(["a@example.org"], ["a@example.org", "b@example.org"])).toBe(false);
  });

  it("sees a removed address as a change", () => {
    expect(sameCcList(["a@example.org", "b@example.org"], ["a@example.org"])).toBe(false);
  });

  it("ignores order", () => {
    // Removing an address and adding it back puts it at the end of the list,
    // which changes the order without changing who gets copied. Offering to
    // save that would be offering to save nothing.
    expect(sameCcList(["a@example.org", "b@example.org"], ["b@example.org", "a@example.org"]))
      .toBe(true);
  });

  it("ignores case, because the stored form is normalised anyway", () => {
    expect(sameCcList(["a@example.org"], ["A@Example.ORG"])).toBe(true);
  });

  it("does not call a shorter list equal to a longer one that contains it", () => {
    // A plain "every entry of A is in B" check passes here. It must not.
    expect(sameCcList(["a@example.org"], ["a@example.org", "a@example.org"])).toBe(false);
  });
});
