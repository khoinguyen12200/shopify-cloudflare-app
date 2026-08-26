import { describe, it, expect } from "vitest";
import { composeEmailMessage } from "./compose";

const payload = {
  recipientName: "Alpha Store",
  staffName: "Sam",
  subject: "Checkout is broken",
  excerpt: "It fails at payment.",
  threadUrl: "https://example.test/app/support/t1",
};

const compose = (cc: readonly string[]) =>
  composeEmailMessage("support_staff_reply", payload, "owner@shop.test", cc);

/**
 * The hop that used to be missing entirely: `EmailMessage.cc` was declared and
 * forwarded by the transport, but nothing ever set it, so a merchant's copy
 * list was stored and never delivered to.
 */
describe("composing a support reply email", () => {
  it("puts the copied addresses on the message", async () => {
    const message = await compose(["dev@shop.test", "ops@shop.test"]);
    expect(message.cc).toEqual(["dev@shop.test", "ops@shop.test"]);
  });

  it("OMITS cc entirely when nobody was copied", async () => {
    // Absent, not `[]`: the transport spreads `cc` only when it is a non-empty
    // array, and an empty one would be a field asserting something untrue.
    const message = await compose([]);
    expect(message.cc).toBeUndefined();
    expect("cc" in message).toBe(false);
  });

  it("still addresses the primary recipient", async () => {
    const message = await compose(["dev@shop.test"]);
    expect(message.to).toBe("owner@shop.test");
  });

  it("renders both an HTML and a text body", async () => {
    // An HTML-only message is penalised by essentially every spam filter, and
    // adding a cc must not quietly change what is rendered.
    const message = await compose(["dev@shop.test"]);
    expect(message.kind).toBe("email");
    expect(message.subject.length).toBeGreaterThan(0);
    expect(message.html).toContain("Sam");
    expect(message.text).toContain("Sam");
  });

  it("does not let the copy list alias the caller's array", async () => {
    // The message outlives the call; sharing the array would let a later edit
    // to the ticket's cc list mutate a message already handed to the transport.
    const cc = ["dev@shop.test"];
    const message = await compose(cc);
    cc.push("late@shop.test");
    expect(message.cc).toEqual(["dev@shop.test"]);
  });
});
