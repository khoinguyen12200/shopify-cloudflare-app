import { defineAiTask } from "../task";
import { buildReplyPrompt } from "../reply-prompt";
import type { ThreadForPrompt } from "../draft-prompt";
import type { ReplyTone } from "../tones";

export interface ReplyTaskInput {
  readonly thread: ThreadForPrompt;
  /** What is already in the reply box, for the polish case. */
  readonly currentText: string;
  /**
   * What the staff member typed into the AI box — their shorthand for what to
   * say. Present means GENERATE from it; empty falls back to polishing the
   * reply box, or suggesting one from the thread.
   */
  readonly instruction: string;
  readonly tone: ReplyTone;
}

/**
 * Write the next reply, in a chosen tone.
 *
 * Three jobs behind one task, picked from what the staff member gave us: turn a
 * note into a message, polish what they already wrote, or suggest one from the
 * thread. One task rather than three because the prompt, the purpose and the
 * ledger name are the same — only the instruction line differs.
 */
export const replyTask = defineAiTask<ReplyTaskInput>({
  feature: "support.reply_draft",
  role: "writing",
  buildMessages: (input) => buildReplyPrompt(input),
});
