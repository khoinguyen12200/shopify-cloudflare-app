import { describe, it, expect } from "vitest";
import { buildReplyDraftPrompt, buildThreadSummaryPrompt } from "./draft-prompt";

const thread = {
  subject: "Checkout is broken",
  shopName: "Alpha Store",
  category: "bug" as const,
  messages: [
    { author: "merchant" as const, authorName: "Alpha Store", body: "Payment fails at the last step." },
    { author: "staff" as const, authorName: "Sam", body: "Which card are you using?" },
    { author: "merchant" as const, authorName: "Alpha Store", body: "Visa, ending 4242." },
  ],
};

describe("the reply-draft prompt", () => {
  it("puts the instructions in a system message and the thread in a user message", () => {
    const messages = buildReplyDraftPrompt(thread);

    expect(messages[0]?.role).toBe("system");
    expect(messages.at(-1)?.role).toBe("user");
  });

  it("includes every message in the thread, in order", () => {
    const user = buildReplyDraftPrompt(thread).at(-1)?.content ?? "";

    expect(user).toContain("Payment fails at the last step.");
    expect(user).toContain("Which card are you using?");
    expect(user).toContain("Visa, ending 4242.");
    expect(user.indexOf("Payment fails")).toBeLessThan(user.indexOf("Visa, ending"));
  });

  it("attributes each message to a side the model can tell apart", () => {
    const user = buildReplyDraftPrompt(thread).at(-1)?.content ?? "";
    expect(user).toContain("Merchant");
    expect(user).toContain("Support");
  });

  it("names the shop and the subject, so the draft can be specific", () => {
    const user = buildReplyDraftPrompt(thread).at(-1)?.content ?? "";
    expect(user).toContain("Alpha Store");
    expect(user).toContain("Checkout is broken");
  });

  it("tells the model to write ONLY the reply body", () => {
    // Otherwise it returns "Sure! Here's a draft:" and a subject line, which a
    // human then has to delete every single time.
    const system = buildReplyDraftPrompt(thread)[0]?.content ?? "";
    expect(system.toLowerCase()).toContain("only");
  });

  it("forbids inventing facts, which is the failure that matters here", () => {
    const system = buildReplyDraftPrompt(thread)[0]?.content ?? "";
    expect(system.toLowerCase()).toMatch(/do not (invent|make up)|never invent/);
  });

  it("handles a thread with a single opening message", () => {
    const messages = buildReplyDraftPrompt({ ...thread, messages: [thread.messages[0]!] });
    expect(messages).toHaveLength(2);
    expect(messages.at(-1)?.content).toContain("Payment fails at the last step.");
  });

  it("survives an empty message body without emitting a stray label", () => {
    const messages = buildReplyDraftPrompt({
      ...thread,
      messages: [{ author: "merchant", authorName: "Alpha Store", body: "" }],
    });
    expect(messages.at(-1)?.content).not.toContain("undefined");
  });
});

describe("the thread-summary prompt", () => {
  it("asks for a short summary and includes the thread", () => {
    const messages = buildThreadSummaryPrompt(thread);

    expect(messages[0]?.role).toBe("system");
    expect(messages.at(-1)?.content).toContain("Payment fails at the last step.");
  });

  it("asks for the outstanding question, which is what triage needs", () => {
    const system = buildThreadSummaryPrompt(thread)[0]?.content ?? "";
    expect(system.toLowerCase()).toContain("waiting");
  });
});
