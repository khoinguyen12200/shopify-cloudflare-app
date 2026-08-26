import { describe, it, expect } from "vitest";
import { copyRecipients } from "./copy-recipients";

const none: ReadonlySet<string> = new Set();

describe("who actually gets copied on a notification", () => {
  it("is empty when nobody was copied", () => {
    expect(copyRecipients({ cc: [], to: "owner@shop.test", optedOut: none })).toEqual([]);
  });

  it("keeps the copied addresses, in the order they were given", () => {
    expect(
      copyRecipients({
        cc: ["dev@shop.test", "ops@shop.test"],
        to: "owner@shop.test",
        optedOut: none,
      }),
    ).toEqual(["dev@shop.test", "ops@shop.test"]);
  });

  it("normalises case and whitespace", () => {
    expect(
      copyRecipients({ cc: ["  Dev@Shop.TEST "], to: "owner@shop.test", optedOut: none }),
    ).toEqual(["dev@shop.test"]);
  });

  it("never copies the primary recipient — that would deliver twice", () => {
    expect(
      copyRecipients({
        cc: ["owner@shop.test", "dev@shop.test"],
        to: "owner@shop.test",
        optedOut: none,
      }),
    ).toEqual(["dev@shop.test"]);
  });

  it("compares the primary recipient case-insensitively", () => {
    expect(
      copyRecipients({ cc: ["OWNER@shop.test"], to: "owner@Shop.test", optedOut: none }),
    ).toEqual([]);
  });

  it("drops an address that has opted out", () => {
    // Consent is not a preference. A colleague who unsubscribed must not be
    // copied back in through someone else's ticket.
    expect(
      copyRecipients({
        cc: ["dev@shop.test", "gone@shop.test"],
        to: "owner@shop.test",
        optedOut: new Set(["gone@shop.test"]),
      }),
    ).toEqual(["dev@shop.test"]);
  });

  it("matches an opt-out case-insensitively", () => {
    expect(
      copyRecipients({
        cc: ["Gone@Shop.test"],
        to: "owner@shop.test",
        optedOut: new Set(["gone@shop.test"]),
      }),
    ).toEqual([]);
  });

  it("removes duplicates, keeping the first occurrence", () => {
    expect(
      copyRecipients({
        cc: ["dev@shop.test", "DEV@shop.test", "ops@shop.test"],
        to: "owner@shop.test",
        optedOut: none,
      }),
    ).toEqual(["dev@shop.test", "ops@shop.test"]);
  });

  it("ignores blank entries", () => {
    expect(
      copyRecipients({ cc: ["", "   ", "dev@shop.test"], to: "owner@shop.test", optedOut: none }),
    ).toEqual(["dev@shop.test"]);
  });

  it("returns empty when every copy was filtered out", () => {
    expect(
      copyRecipients({
        cc: ["owner@shop.test", "gone@shop.test"],
        to: "owner@shop.test",
        optedOut: new Set(["gone@shop.test"]),
      }),
    ).toEqual([]);
  });
});
