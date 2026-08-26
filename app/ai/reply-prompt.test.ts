import { describe, it, expect } from "vitest";
import { buildReplyPrompt, replyMode } from "./reply-prompt";
import { TONE_GUIDE } from "./tones";

const thread = {
  subject: "Checkout is broken",
  shopName: "Alpha Store",
  category: "bug" as const,
  messages: [
    { author: "merchant" as const, authorName: "Alpha Store", body: "Payment fails at the last step." },
  ],
};

const user = (messages: { role: string; content: string }[]) => messages.at(-1)?.content ?? "";
const system = (messages: { role: string; content: string }[]) => messages[0]?.content ?? "";

describe("which job the model is being asked to do", () => {
  it("is polish when the staff member has already written something", () => {
    expect(replyMode("We are looking into it")).toBe("polish");
  });

  it("is suggest when the box is empty", () => {
    expect(replyMode("")).toBe("suggest");
    expect(replyMode("   \n ")).toBe("suggest");
  });
});

describe("polishing what a staff member wrote", () => {
  const messages = buildReplyPrompt({
    thread,
    currentText: "we r looking at it, prob the card thing. will update u",
    tone: "professional",
  });

  it("sends the staff member's own words to be rewritten", () => {
    expect(user(messages)).toContain("we r looking at it");
  });

  it("tells the model to KEEP the meaning rather than write something new", () => {
    // The staff member decided what to say; the model is only choosing better
    // words for it. Losing a stated fact is this feature's worst failure.
    expect(user(messages).toLowerCase()).toMatch(/keep|preserve/);
  });

  it("forbids inventing facts the draft did not state", () => {
    expect(system(messages).toLowerCase()).toMatch(/do not invent|never invent/);
  });

  it("still includes the thread, so the rewrite has context", () => {
    expect(user(messages)).toContain("Payment fails at the last step.");
  });

  it("asks for only the message body", () => {
    expect(system(messages).toLowerCase()).toContain("only");
  });
});

describe("suggesting a reply when nothing is written yet", () => {
  const messages = buildReplyPrompt({ thread, currentText: "", tone: "professional" });

  it("asks for a fitting next reply", () => {
    expect(user(messages).toLowerCase()).toMatch(/suggest|write/);
  });

  it("does not claim the staff member wrote something", () => {
    expect(user(messages).toLowerCase()).not.toMatch(/keep its meaning/);
  });

  it("still carries the thread", () => {
    expect(user(messages)).toContain("Payment fails at the last step.");
  });
});

describe("tone", () => {
  it.each(["professional", "friendly", "short"] as const)(
    "puts the %s guide in the system message",
    (tone) => {
      const messages = buildReplyPrompt({ thread, currentText: "hi", tone });
      expect(system(messages)).toContain(TONE_GUIDE[tone]);
    },
  );

  it("changes the prompt when the tone changes", () => {
    // If it did not, the tone control would be decoration.
    const a = buildReplyPrompt({ thread, currentText: "hi", tone: "professional" });
    const b = buildReplyPrompt({ thread, currentText: "hi", tone: "short" });
    expect(system(a)).not.toBe(system(b));
  });
});
