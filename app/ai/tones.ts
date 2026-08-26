/**
 * How a drafted reply should sound.
 *
 * A closed set with a `guide` phrase per tone, because "professional" means
 * nothing to a model on its own — the guide is what actually reaches the
 * prompt. Pure: a union and its copy, no I/O.
 */
export const REPLY_TONES = ["professional", "friendly", "short"] as const;

export type ReplyTone = (typeof REPLY_TONES)[number];

export const DEFAULT_TONE: ReplyTone = "professional";

export const TONE_LABEL: Record<ReplyTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  short: "Short",
};

/** The phrase handed to the model. Written as an instruction, not a label. */
export const TONE_GUIDE: Record<ReplyTone, string> = {
  professional: "professional, polished and courteous",
  friendly: "warm, friendly and conversational",
  short: "very concise — one or two sentences, straight to the point",
};

/** Narrow an untrusted string — a form field — to a tone. */
export function isReplyTone(value: string): value is ReplyTone {
  return REPLY_TONES.some((tone) => tone === value);
}

/** A tone from a form value, falling back rather than failing. */
export function toReplyTone(value: string): ReplyTone {
  return isReplyTone(value) ? value : DEFAULT_TONE;
}
