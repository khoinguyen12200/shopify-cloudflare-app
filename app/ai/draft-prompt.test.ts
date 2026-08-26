import { describe, it, expect } from "vitest";
import { buildThreadSummaryPrompt } from "./draft-prompt";

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
