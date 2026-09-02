import { describe, expect, it } from "vitest";
import { runScheduledSweeps } from "./scheduled.server";

describe("runScheduledSweeps", () => {
  it("uses injected token and history ports", async () => {
    const calls: string[] = [];
    await runScheduledSweeps(100, {
      tokens: { deleteExpiredBefore: async () => { calls.push("tokens"); return 0; } },
      history: { reconcile: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 0 }; } },
    });
    expect(calls).toEqual(["tokens", "history"]);
  });
});
