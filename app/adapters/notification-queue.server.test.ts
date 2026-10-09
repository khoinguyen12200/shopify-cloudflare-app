import { describe, expect, it } from "vitest";
import { CloudflareNotificationQueue } from "./notification-queue.server";

describe("CloudflareNotificationQueue", () => {
  it("sends one JSON envelope", async () => {
    const calls: unknown[][] = [];
    const queue = new CloudflareNotificationQueue({ send: async (...args) => { calls.push(args); } });
    await queue.enqueue({
      event: "support_staff_reply",
      to: { email: "m@workmanjsc.vn" },
      dedupeKey: "k",
      payload: { recipientName: "M", subject: "s", excerpt: "e", threadUrl: "https://x/y", staffName: "Sam" },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toMatchObject({ v: 1, event: "support_staff_reply", dedupeKey: "k" });
    expect(calls[0]?.[1]).toEqual({ contentType: "json" });
  });

  it("lets a queue failure reach the caller", async () => {
    const queue = new CloudflareNotificationQueue({ send: async () => { throw new Error("down"); } });
    await expect(queue.enqueue({
      event: "admin_password_reset", to: {}, dedupeKey: "k",
      payload: { recipientName: "x", resetUrl: "u", expiresIn: "e" },
    })).rejects.toThrow("down");
  });
});
