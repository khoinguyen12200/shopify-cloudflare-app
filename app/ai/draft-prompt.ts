import type { SupportCategory } from "~/support/categories";

/**
 * The prompts, as pure functions.
 *
 * PURE and ring 1 on purpose: prompt wording is where nearly all of a feature's
 * quality lives, and it is the one part of an AI feature that can be tested
 * exhaustively for free — no binding, no tokens, no flake. Everything the model
 * sees is assembled here from facts the caller already holds.
 *
 * The reply composer's own prompt lives in `./reply-prompt`, because it has two
 * modes and a tone; this file holds the shared types and the summary.
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
