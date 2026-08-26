import { defineAiTask } from "../task";
import { buildReplyPrompt } from "../reply-prompt";
import type { ThreadForPrompt } from "../draft-prompt";
import type { ReplyTone } from "../tones";

export interface ReplyTaskInput {
  readonly thread: ThreadForPrompt;
  /** What the staff member has already written. Empty means "suggest one". */
  readonly currentText: string;
  readonly tone: ReplyTone;
}

/**
 * Rewrite the reply a staff member is writing, in a chosen tone — or suggest one
 * when the box is empty.
 */
export const replyTask = defineAiTask<ReplyTaskInput>({
  feature: "support.reply_draft",
  role: "writing",
  buildMessages: (input) => buildReplyPrompt(input),
});
