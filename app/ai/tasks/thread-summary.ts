import { defineAiTask } from "../task";
import { buildThreadSummaryPrompt, type ThreadForPrompt } from "../draft-prompt";

export interface ThreadSummaryInput {
  readonly thread: ThreadForPrompt;
}

/** Two sentences on what a thread needs and who it waits on, for triage. */
export const threadSummaryTask = defineAiTask<ThreadSummaryInput>({
  feature: "support.thread_summary",
  role: "summary",
  maxTokens: 200,
  buildMessages: ({ thread }) => buildThreadSummaryPrompt(thread),
});
