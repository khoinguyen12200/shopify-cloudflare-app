import { describe, expect, it } from "vitest";
import { parseEnvelope, toEnvelope, type QueuedNotification } from "./envelope";

const reset: QueuedNotification = {
  event: "admin_password_reset",
  to: { email: "ops@workmanjsc.vn" },
  dedupeKey: "admin_password_reset:abc",
  logId: "log-1",
  payload: { recipientName: "Ops", resetUrl: "https://app.workmanjsc.vn/r/t", expiresIn: "one hour" },
};

const onTheWire = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe("notification envelope", () => {
  it("round-trips a request through JSON", () => {
    const parsed = parseEnvelope(onTheWire(toEnvelope(reset)));
    expect(parsed).toEqual({ ok: true, value: reset });
  });

  it("round-trips optional scope and copies", () => {
    const withCopies: QueuedNotification = {
      event: "support_staff_reply",
      to: { email: "merchant@workmanjsc.vn" },
      cc: { email: ["boss@workmanjsc.vn"] },
      scope: "shop.myshopify.com",
      dedupeKey: "k",
      payload: { recipientName: "M", subject: "s", excerpt: "e", threadUrl: "https://x/y", staffName: "Sam" },
    };
    expect(parseEnvelope(onTheWire(toEnvelope(withCopies)))).toEqual({ ok: true, value: withCopies });
  });

  it("covers every event with a payload schema", () => {
    const merchantActivity: QueuedNotification = {
      event: "support_merchant_activity",
      to: { email: "staff@workmanjsc.vn" },
      dedupeKey: "k",
      payload: { recipientName: "S", subject: "s", excerpt: "e", threadUrl: "https://x/y", shopName: "Shop", isNew: true },
    };
    expect(parseEnvelope(onTheWire(toEnvelope(merchantActivity))).ok).toBe(true);
  });

  it("rejects an unknown event by name", () => {
    expect(parseEnvelope({ ...toEnvelope(reset), event: "retired_event" })).toMatchObject({ ok: false, reason: "unknown_event" });
  });

  it("rejects a payload that does not match its event", () => {
    expect(parseEnvelope({ ...toEnvelope(reset), payload: { recipientName: "Ops" } })).toMatchObject({ ok: false, reason: "invalid_payload" });
  });

  it("rejects a body with no dedupe key", () => {
    expect(parseEnvelope({ ...toEnvelope(reset), dedupeKey: undefined })).toMatchObject({ ok: false, reason: "malformed" });
  });

  it.each([null, undefined, "text", 42, [], {}])("rejects %j as malformed", (body) => {
    expect(parseEnvelope(body)).toMatchObject({ ok: false });
  });

  it("drops fields the schema does not know instead of passing them on", () => {
    const parsed = parseEnvelope({ ...toEnvelope(reset), payload: { ...reset.payload, extra: "x" } });
    expect(parsed.ok && "extra" in parsed.value.payload).toBe(false);
  });
});
