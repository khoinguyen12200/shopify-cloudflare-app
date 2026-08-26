import type { PromptMessage } from "~/ai/draft-prompt";


/**
 * The port a use case depends on to generate text.
 *
 * Narrow on purpose — two methods, because we have two callers. The reference
 * implementation this is modelled on carries six (structured, tools, audio,
 * embeddings…) for callers that do not exist here, which @rules/design-patterns.md
 * calls out directly: no interface with one caller, no ceremony for a seam the
 * rules do not name. Widen it when a second kind of call actually arrives.
 *
 * A caller names a ROLE, never a model id. Which model serves a role is a row
 * in `ai_models` that an admin picked from a catalogue, so a feature cannot
 * pin itself to a model that is later retired.
 *
 * Imports only pure types, so the fake in `~/test/fake-ai` needs nothing.
 */
export type AiFailureReason =
  /**
   * No model is configured for the role. Decided by the USE CASE, never by the
   * adapter: which model serves a purpose is a business decision, and leaving
   * it in the adapter made it unreachable from any test that injected a fake.
   */
  | "no_model"
  /** The Workers AI binding is absent — local dev without `--remote`, usually. */
  | "not_configured"
  /** The provider refused or errored. */
  | "provider"
  | "timeout"
  | "rate_limited"
  /**
   * The caller may not use AI at all — a plan that does not include it. NOT a
   * failure of the model, and never retriable: no other model fixes it.
   */
  | "forbidden";

/**
 * Whether trying the NEXT model in the chain could plausibly help.
 *
 * `not_configured` cannot: no Workers AI binding is a fact about the
 * environment, not about the model, so walking three candidates would waste
 * three round trips to reach the same answer. A provider error, a timeout or a
 * rate limit are all specific to the model that produced them.
 */
export function isRetriable(reason: AiFailureReason): boolean {
  return reason === "provider" || reason === "timeout" || reason === "rate_limited";
}

export interface AiUsage {
  readonly model: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface GenerateRequest {
  /** A concrete Workers AI id. The caller has already resolved the role. */
  readonly model: string;
  readonly messages: readonly PromptMessage[];
  readonly maxTokens?: number;
}

export interface GeneratedText {
  readonly text: string;
  readonly usage: AiUsage;
}

/**
 * A stream, plus the usage that is only known once it finishes.
 *
 * `usage` resolves AFTER the stream is drained — that is not a quirk of this
 * port but of every streaming provider, and pretending otherwise is how a
 * metered surface ends up recording zero tokens for every streamed call.
 */
export interface GeneratedStream {
  readonly textStream: AsyncIterable<string>;
  readonly usage: Promise<AiUsage>;
}

/**
 * A request for a value of a known SHAPE rather than prose.
 *
 * The schema is JSON Schema because that is what a provider speaks. The task
 * holds the Zod schema and the service converts, so a task author never writes
 * JSON Schema by hand and the validated value stays typed.
 */
export interface GenerateObjectRequest extends GenerateRequest {
  readonly schema: Record<string, unknown>;
}

export interface GeneratedObject {
  /**
   * Unvalidated on purpose: the provider says it matched the schema, and the
   * service checks that claim against the task's Zod type before any caller
   * sees it. A provider's word about its own output is not a guarantee.
   */
  readonly value: unknown;
  readonly usage: AiUsage;
}

export interface TextGenerator {
  generate(request: GenerateRequest): Promise<GeneratedText>;
  stream(request: GenerateRequest): Promise<GeneratedStream>;
  /**
   * Ask for a value of a known shape.
   *
   * Separate from `generate` because the provider call is genuinely different —
   * the schema is sent to the model and constrains decoding — not because the
   * result is parsed afterwards. `extraction` and `classification` exist as
   * purposes precisely so a task can ask for this.
   */
  generateObject(request: GenerateObjectRequest): Promise<GeneratedObject>;
}

/** Thrown by an adapter; the service turns it into a `Result` for the caller. */
export class AiError extends Error {
  constructor(
    readonly reason: AiFailureReason,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}
