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
  | "rate_limited";

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

export interface TextGenerator {
  generate(request: GenerateRequest): Promise<GeneratedText>;
  stream(request: GenerateRequest): Promise<GeneratedStream>;
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
