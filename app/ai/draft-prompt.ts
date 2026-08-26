import type { SupportCategory } from "~/support/categories";

/**
 * The prompts, as pure functions.
 *
 * PURE and ring 1 on purpose: prompt wording is where nearly all of a feature's
 * quality lives, and it is the one part of an AI feature that can be tested
 * exhaustively for free — no binding, no tokens, no flake. Everything the model
 * sees is assembled here from facts the caller already holds.
 */

export type PromptRole = "system" | "user";

export interface PromptMessage {
  readonly role: PromptRole;
  readonly content: string;
}

export interface ThreadForPrompt {
  readonly subject: string;
  readonly shopName: string;
  readonly category: SupportCategory;
  readonly messages: readonly {
    readonly author: "merchant" | "staff";
    readonly authorName: string;
    readonly body: string;
  }[];
}

/**
 * "Merchant" / "Support" rather than the real names: the model needs to know
 * which SIDE spoke, and a person's name does not tell it that.
 */
function transcript(thread: ThreadForPrompt): string {
  return thread.messages
    .map((message) => {
      const side = message.author === "merchant" ? "Merchant" : "Support";
      return `${side}: ${message.body}`.trimEnd();
    })
    .join("\n\n");
}

function context(thread: ThreadForPrompt): string {
  return [
    `Shop: ${thread.shopName}`,
    `Subject: ${thread.subject}`,
    `Type: ${thread.category}`,
    "",
    transcript(thread),
  ].join("\n");
}

/**
 * Draft the next support reply.
 *
 * Two instructions carry most of the weight. "Only the reply body" exists
 * because a chat model otherwise returns "Sure! Here's a draft:" plus a subject
 * line, and a human deletes both every time. "Do not invent" exists because the
 * expensive failure here is a confident, wrong specific — a version number, a
 * date, a setting — that a staff member skims past and sends.
 */
export function buildReplyDraftPrompt(thread: ThreadForPrompt): PromptMessage[] {
  return [
    {
      role: "system",
      content: [
        "You draft replies for a Shopify app's support team.",
        "",
        "Write ONLY the body of the next reply. No greeting line of your own invention, no subject, no sign-off, no preamble such as \"Here is a draft\".",
        "Match the merchant's language.",
        "Be specific and short — three sentences unless the question genuinely needs more.",
        "Do not invent facts. If the thread does not contain something you need, ask for it plainly instead of guessing.",
        "If the merchant reported a bug, say what happens next rather than promising a fix or a date.",
        "A human will read and edit this before it is sent.",
      ].join("\n"),
    },
    { role: "user", content: context(thread) },
  ];
}

/** Summarise a thread for triage — what it is about, and who it is waiting on. */
export function buildThreadSummaryPrompt(thread: ThreadForPrompt): PromptMessage[] {
  return [
    {
      role: "system",
      content: [
        "You summarise support threads for the team that answers them.",
        "",
        "Two sentences at most: what the merchant needs, and what it is waiting on.",
        "Write only the summary — no heading, no preamble.",
        "Do not invent facts or suggest a resolution.",
      ].join("\n"),
    },
    { role: "user", content: context(thread) },
  ];
}
