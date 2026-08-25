import { describe, it, expect } from "vitest";
import { statusOf, isUnreadFor, SUPPORT_STATUSES } from "./status";

/** The two stored facts every derivation reads. */
const ticket = (over: Partial<Parameters<typeof statusOf>[0]> = {}) => ({
  lastAuthor: "merchant" as const,
  closedAt: null,
  ...over,
});

describe("statusOf", () => {
  it("is open while the merchant spoke last — the ball is with us", () => {
    expect(statusOf(ticket({ lastAuthor: "merchant" }))).toBe("open");
  });

  it("is answered once staff spoke last — the ball is with the merchant", () => {
    expect(statusOf(ticket({ lastAuthor: "staff" }))).toBe("answered");
  });

  it("is closed whenever closedAt is set, whoever spoke last", () => {
    // Closing is the one fact that overrides whose turn it was.
    expect(statusOf(ticket({ lastAuthor: "merchant", closedAt: 1 }))).toBe("closed");
    expect(statusOf(ticket({ lastAuthor: "staff", closedAt: 1 }))).toBe("closed");
  });

  it("treats a closedAt of 0 as closed, not as absent", () => {
    // Epoch 0 is falsy — a `closedAt ? …` check would call this thread live.
    expect(statusOf(ticket({ closedAt: 0 }))).toBe("closed");
  });

  it("only ever returns a declared status", () => {
    for (const lastAuthor of ["merchant", "staff"] as const) {
      for (const closedAt of [null, 0, 1_700_000_000_000]) {
        expect(SUPPORT_STATUSES).toContain(statusOf({ lastAuthor, closedAt }));
      }
    }
  });
});

describe("isUnreadFor", () => {
  it("is unread when the other side wrote after you last looked", () => {
    expect(isUnreadFor({ lastMessageAt: 200, lastReadAt: 100 })).toBe(true);
  });

  it("is read once you looked after the last message", () => {
    expect(isUnreadFor({ lastMessageAt: 100, lastReadAt: 200 })).toBe(false);
  });

  it("is read when you looked at exactly the last message's time", () => {
    // Equal means you have seen it — otherwise opening a thread leaves it
    // permanently unread when both timestamps land in the same millisecond.
    expect(isUnreadFor({ lastMessageAt: 100, lastReadAt: 100 })).toBe(false);
  });

  it("is unread when you have never opened it", () => {
    expect(isUnreadFor({ lastMessageAt: 1, lastReadAt: null })).toBe(true);
  });

  it("handles a read receipt at epoch 0 as a real read, not as never", () => {
    expect(isUnreadFor({ lastMessageAt: 0, lastReadAt: 0 })).toBe(false);
  });
});
