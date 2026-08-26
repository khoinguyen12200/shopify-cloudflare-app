import type { PromptMessage } from "./draft-prompt";
import type { ModelRole } from "./roles";

/**
 * ONE AI FEATURE, described as data.
 *
 * This is the seam that decides how much work adding an AI feature is. Without
 * it, every feature is another method on the service, and the service grows a
 * branch per surface — which is the shape that makes an AI layer expensive to
 * extend and impossible to test in one place.
 *
 * With it, a feature is a file: name the purpose it needs, name itself for the
 * ledger, and turn its input into messages. Everything else — the gate, the
 * fallback chain, health, metering, streaming, the `Result` — is already done
 * and is identical for every task.
 *
 * STRATEGY, not a registry: tasks are dispatched by IMPORTING one, never by
 * looking a string up in a map, so a caller cannot ask for a task that does not
 * exist and no dispatcher needs editing (@rules/design-patterns.md — a registry
 * is for behaviour that varies by a STORED type string, which this is not).
 *
 * @example A whole new AI feature
 * ```ts
 * // app/ai/tasks/refund-explainer.ts
 * export const refundExplainerTask = defineAiTask<{ order: OrderSummary }>({
 *   feature: "billing.refund_explainer",
 *   role: "writing",
 *   buildMessages: ({ order }) => [
 *     { role: "system", content: "Explain a refund to a merchant, plainly." },
 *     { role: "user", content: describe(order) },
 *   ],
 * });
 *
 * // any route
 * const result = await new AiService().run(refundExplainerTask, { order }, caller);
 * ```
 * That is the whole change: one new file, one call. No edit to the service, the
 * adapter, the gate or the ledger.
 */
export interface AiTask<Input> {
  /**
   * Stable name for the `ai_runs` ledger, e.g. `"support.reply_draft"`.
   *
   * `<area>.<thing>` by convention, so cost and failure rates can be read per
   * feature. Never renamed once shipped — history is keyed by it.
   */
  readonly feature: string;
  /** Which purpose's chain runs it. The task names a capability, never a model. */
  readonly role: ModelRole;
  /** Ceiling on the answer. Omit for the service default. */
  readonly maxTokens?: number;
  /** The whole prompt, from the task's own input. PURE — no I/O in here. */
  buildMessages(input: Input): PromptMessage[];
}

/**
 * Identity, for the inference.
 *
 * `defineAiTask<Input>({...})` gives `buildMessages` a typed parameter and makes
 * the task's input type flow to `service.run(task, input)`, so a caller cannot
 * pass the wrong shape.
 */
export function defineAiTask<Input>(task: AiTask<Input>): AiTask<Input> {
  return task;
}
