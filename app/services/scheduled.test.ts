import { describe, expect, it, vi } from "vitest";
import { runScheduledSweeps } from "./scheduled.server";

describe("runScheduledSweeps", () => {
  it("uses injected token and history ports", async () => {
    const calls: string[] = [];
    await runScheduledSweeps(100, {
      tokens: { deleteExpiredBefore: async () => { calls.push("tokens"); return 0; } },
      uploads: {
        listExpiredUploads: async () => { calls.push("uploads"); return []; },
        deleteUploadObjects: async () => undefined,
        deleteExpiredUploads: async () => 0,
      },
      history: { reconcile: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 0 }; } },
    });
    expect(calls).toEqual(["tokens", "uploads", "history"]);
  });

  it("sweeps uploads in list, R2 delete, D1 delete order", async () => {
    const calls: string[] = [];
    await runScheduledSweeps(200, {
      tokens: { deleteExpiredBefore: async () => 0 },
      uploads: {
        listExpiredUploads: async (cutoff) => { calls.push(`list:${cutoff}`); return [{ id: "upload-1", r2Key: "r2/upload-1" }]; },
        deleteUploadObjects: async (keys) => { calls.push(`r2:${keys.join(",")}`); },
        deleteExpiredUploads: async (ids, cutoff) => { calls.push(`d1:${ids.join(",")}:${cutoff}`); return ids.length; },
      },
      history: { reconcile: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 0 }; } },
    });
    expect(calls).toEqual(["list:200", "r2:r2/upload-1", "d1:upload-1:200", "history"]);
  });

  it("leaves uploads for a later tick when R2 deletion fails", async () => {
    const calls: string[] = [];
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await runScheduledSweeps(200, {
        tokens: { deleteExpiredBefore: async () => 0 },
        uploads: {
          listExpiredUploads: async () => [{ id: "upload-1", r2Key: "r2/upload-1" }],
          deleteUploadObjects: async () => { calls.push("r2"); throw new Error("R2 unavailable"); },
          deleteExpiredUploads: async () => { calls.push("d1"); return 0; },
        },
        history: { reconcile: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 0 }; } },
      });
      expect(error).toHaveBeenCalledWith(expect.stringContaining('"event":"cron.sweep_failed"'));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('"sweep":"pending_uploads"'));
    } finally {
      error.mockRestore();
    }
    expect(calls).toEqual(["r2", "history"]);
  });

  it("does not call R2 or D1 when there are no expired uploads", async () => {
    const calls: string[] = [];
    await runScheduledSweeps(200, {
      tokens: { deleteExpiredBefore: async () => 0 },
      uploads: {
        listExpiredUploads: async () => [],
        deleteUploadObjects: async () => { calls.push("r2"); },
        deleteExpiredUploads: async () => { calls.push("d1"); return 0; },
      },
      history: { reconcile: async () => { calls.push("history"); return { status: "succeeded", pages: 1, events: 0 }; } },
    });
    expect(calls).toEqual(["history"]);
  });
});
