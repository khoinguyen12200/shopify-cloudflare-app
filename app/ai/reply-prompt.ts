import type { PromptMessage, ThreadForPrompt } from "./draft-prompt";
import { TONE_GUIDE, type ReplyTone } from "./tones";

/**
 * The prompt for the reply composer, as pure functions.
 *
 * The job is POLISH, not authorship. A staff member has already decided what to
 * say; the model is choosing better words for it. That distinction is the whole
 * feature — a model that "improves" a draft by adding a fact nobody stated has
 * failed, however well it reads.
 *
 * When the box is empty there is nothing to polish, so it suggests a reply from
 * the thread instead. Same prompt builder, different task line, so the two
 * modes cannot drift apart.
 */

export type ReplyMode = "polish" | "suggest";

/** Which job the text in the box implies. */
export function replyMode(currentText: string): ReplyMode {
  return currentText.trim() === "" ? "suggest" : "polish";
}

function transcript(thread: ThreadForPrompt): string {
  return thread.messages
    .map((message) => {
      const side = message.author === "merchant" ? "Merchant" : "Support";
      return `${side}: ${message.body}`.trimEnd();
    })
    .join("\n\n");
}

export function buildReplyPrompt(input: {
  thread: ThreadForPrompt;
  currentText: string;
  tone: ReplyTone;
}): PromptMessage[] {
  const mode = replyMode(input.currentText);

  const task =
    mode === "polish"
      ? [
          "Rewrite the draft below so it reads well.",
          "KEEP its meaning and every specific fact it states — names, numbers, dates, promises.",
          "Do not add anything it does not say.",
          "",
          "Draft:",
          input.currentText.trim(),
        ].join("\n")
      : "Suggest a fitting next reply, based on the thread below.";

  return [
    {
      role: "system",
      content: [
        "You write replies for a Shopify app's support team.",
        `Write in a tone that is ${TONE_GUIDE[input.tone]}.`,
        "",
        "Write ONLY the body of the reply. No subject, no preamble such as \"Here is a draft\", no commentary about what you changed.",
        "Match the merchant's language.",
        "Do not invent facts. If something needed is missing, ask for it plainly instead of guessing.",
        "A human will read and edit this before it is sent.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        task,
        "",
        "— Context —",
        `Shop: ${input.thread.shopName}`,
        `Subject: ${input.thread.subject}`,
        `Type: ${input.thread.category}`,
        "",
        transcript(input.thread),
      ].join("\n"),
    },
  ];
}
