import { err, ok, type Result } from "~/lib/result";
import { AiRepo } from "~/models/ai.server";
import { buildReplyDraftPrompt, buildThreadSummaryPrompt, type ThreadForPrompt } from "~/ai/draft-prompt";
import { buildReplyPrompt } from "~/ai/reply-prompt";
import type { ReplyTone } from "~/ai/tones";
import type { ModelRole } from "~/ai/roles";
import type { AiCaller, AiGate } from "~/ports/ai";
import { PlanAiGate } from "~/adapters/plan-ai-gate.server";
import {
  AiError,
  isRetriable,
  type AiFailureReason,
  type AiUsage,
  type GeneratedStream,
  type TextGenerator,
} from "~/ports/ai";
import { WorkersAiGenerator, workersAiModelFactory } from "~/adapters/workers-ai.server";

/**
 * The AI use cases: draft a support reply, summarise a thread.
 *
 * Two properties matter more than anything else here.
 *
 * **AI degrades, it never blocks.** Every path returns a `Result`, never
 * throws — a missing model, a dead provider or a timeout costs the staff member
 * their draft and nothing else. They can always still type a reply
 * (@rules/data.md: degrade decoration, never correctness).
 *
 * **Every call is metered.** One `ai_runs` row per call, success or failure,
 * including the failures — an AI surface nobody can cost is an unbounded bill,
 * and a gap that leaves no row is indistinguishable from a feature nobody used.
 */

interface Clock {
  now(): number;
}

const systemClock: Clock = { now: () => Date.now() };

/** A stream, plus the promise that settles the ledger once it drains. */
export interface DraftStream {
  readonly textStream: AsyncIterable<string>;
  /** Hand this to `waitUntil` — it records the run and never rejects. */
  readonly done: Promise<void>;
}

/** Built here rather than at module load: the binding comes from the request env. */
function defaultGenerator(): TextGenerator {
  return new WorkersAiGenerator({ languageModel: workersAiModelFactory() });
}

export class AiService {
  constructor(
    private readonly repo = new AiRepo(),
    private readonly generator?: TextGenerator,
    private readonly clock: Clock = systemClock,
    /**
     * Who may use AI. A PORT with the policy behind it, so changing "which
     * plans include AI" — or removing gating entirely — is a change to
     * `~/ai/gate` or to what is injected here, and no use case moves.
     */
    private readonly gate: AiGate = new PlanAiGate(),
  ) {}

  /**
   * The gate, checked ONCE per call and before any model is resolved.
   *
   * Ahead of the chain deliberately: a merchant whose plan does not include AI
   * must not cost us a token, and a refusal that arrives after the spend is not
   * a gate. It still leaves a ledger row, so "why did nothing happen" has an
   * answer.
   */
  private async refused(input: {
    caller: AiCaller;
    role: ModelRole;
    feature: string;
  }): Promise<AiFailureReason | null> {
    const reason = await this.gate.refuse({ caller: input.caller, role: input.role });
    if (!reason) return null;

    await this.recordFailure({
      role: input.role,
      feature: input.feature,
      shop: input.caller.shop,
      model: "(gated)",
      reason,
      startedAt: this.clock.now(),
    });
    return reason;
  }

  private get ai(): TextGenerator {
    return this.generator ?? defaultGenerator();
  }

  /** Draft the next reply on a support thread. */
  draftReply(input: {
    thread: ThreadForPrompt;
    caller: AiCaller;
  }): Promise<Result<string, AiFailureReason>> {
    return this.generateOnce({
      role: "writing",
      feature: "support.reply_draft",
      caller: input.caller,
      messages: buildReplyDraftPrompt(input.thread),
    });
  }

  /** A two-sentence summary of a thread, for triage. */
  summariseThread(input: {
    thread: ThreadForPrompt;
    caller: AiCaller;
  }): Promise<Result<string, AiFailureReason>> {
    return this.generateOnce({
      role: "summary",
      feature: "support.thread_summary",
      caller: input.caller,
      messages: buildThreadSummaryPrompt(input.thread),
      maxTokens: 200,
    });
  }

  /**
   * Rewrite what a staff member has already typed, in a chosen tone — or
   * suggest one when the box is empty. Streamed.
   *
   * Refuses BEFORE opening a stream when it cannot run, so "no model" is an
   * answer the composer can show rather than a stream that yields nothing.
   */
  async streamReply(input: {
    thread: ThreadForPrompt;
    currentText: string;
    tone: ReplyTone;
    caller: AiCaller;
  }): Promise<Result<DraftStream, AiFailureReason>> {
    const startedAt = this.clock.now();
    const role: ModelRole = "writing";
    const feature = "support.reply_draft";
    const shop = input.caller.shop;

    const gated = await this.refused({ caller: input.caller, role, feature });
    if (gated) return err(gated);

    const chain = await this.repo.chainFor(role, this.clock.now());
    if (chain.length === 0) {
      await this.recordFailure({ role, feature, shop, model: "(none)", reason: "no_model", startedAt });
      return err("no_model");
    }

    // Falls forward through the chain the same way as a one-shot generation.
    // A stream can only fall back BEFORE its first byte reaches the browser —
    // once the composer has text in it, swapping models mid-draft would splice
    // two different answers together.
    let stream: GeneratedStream | null = null;
    let model = "";
    let last: AiFailureReason = "provider";

    for (const candidate of chain) {
      try {
        stream = await this.ai.stream({
          model: candidate,
          messages: buildReplyPrompt({
            thread: input.thread,
            currentText: input.currentText,
            tone: input.tone,
          }),
        });
        model = candidate;
        break;
      } catch (cause) {
        last = reasonOf(cause);
        await this.afterFailure({ role, feature, shop, model: candidate, reason: last, startedAt });
        if (!isRetriable(last)) return err(last);
      }
    }

    if (!stream) return err(last);

    return ok({
      textStream: stream.textStream,
      // Settled by the caller. Usage is only known once the stream finishes, so
      // reading it eagerly would meter every streamed call at zero.
      done: stream.usage
        .then((usage) =>
          this.afterSuccess({ role, feature, shop, model, usage, startedAt }),
        )
        .catch(async (cause: unknown) => {
          await this.afterFailure({
            role,
            feature,
            shop,
            model,
            reason: reasonOf(cause),
            startedAt,
          });
        }),
    });
  }

  /**
   * Walk the purpose's chain until one model answers.
   *
   * The fallback that makes a chain worth having: a model that errors, times
   * out or is rate-limited costs a retry on the NEXT candidate rather than the
   * feature. A failure no other model can fix stops the walk immediately.
   *
   * Every attempt leaves its own ledger row, so a flaky model is visible as a
   * pattern rather than as an occasional missing draft, and every attempt
   * writes health back so the next request starts on a model that works.
   */
  private async generateOnce(input: {
    role: ModelRole;
    feature: string;
    caller: AiCaller;
    messages: ReturnType<typeof buildReplyDraftPrompt>;
    maxTokens?: number;
  }): Promise<Result<string, AiFailureReason>> {
    const gated = await this.refused(input);
    if (gated) return err(gated);

    const shop = input.caller.shop;
    const chain = await this.repo.chainFor(input.role, this.clock.now());
    if (chain.length === 0) {
      await this.recordFailure({ ...input, shop, model: "(none)", reason: "no_model", startedAt: this.clock.now() });
      return err("no_model");
    }

    let last: AiFailureReason = "provider";

    for (const model of chain) {
      const startedAt = this.clock.now();

      try {
        const result = await this.ai.generate({
          model,
          messages: input.messages,
          ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
        });

        const text = result.text.trim();
        if (text === "") {
          // Whitespace is a failed draft, not a draft — and another model may
          // well produce words, so it is worth the retry.
          last = "provider";
          await this.afterFailure({ ...input, shop, model, reason: last, startedAt });
          continue;
        }

        await this.afterSuccess({ ...input, shop, model, usage: result.usage, startedAt });
        return ok(text);
      } catch (cause) {
        last = reasonOf(cause);
        await this.afterFailure({ ...input, shop, model, reason: last, startedAt });
        // Nothing another model can do about it.
        if (!isRetriable(last)) return err(last);
      }
    }

    // Chain exhausted: the caller hears about the last thing that went wrong.
    return err(last);
  }

  /** Ledger row plus health, after one successful attempt. */
  private async afterSuccess(input: {
    role: ModelRole;
    feature: string;
    shop: string | null;
    model: string;
    usage: AiUsage;
    startedAt: number;
  }): Promise<void> {
    await this.recordSuccess(input);
    // Clears a prior failure, so one bad minute does not sideline a model for
    // the whole recovery window.
    await this.repo.markHealth({
      role: input.role,
      modelId: input.model,
      healthy: true,
      at: this.clock.now(),
    });
  }

  /** Ledger row plus health, after one failed attempt. */
  private async afterFailure(input: {
    role: ModelRole;
    feature: string;
    shop: string | null;
    model: string;
    reason: AiFailureReason;
    startedAt: number;
  }): Promise<void> {
    await this.recordFailure(input);
    // Only the model is demoted, and only for a failure it could be blamed for.
    if (isRetriable(input.reason)) {
      await this.repo.markHealth({
        role: input.role,
        modelId: input.model,
        healthy: false,
        at: this.clock.now(),
      });
    }
  }

  private recordSuccess(input: {
    role: ModelRole;
    feature: string;
    shop: string | null;
    /** What the role resolved to, recorded so history survives a model swap. */
    model: string;
    usage: AiUsage;
    startedAt: number;
  }): Promise<void> {
    return this.repo.recordRun({
      role: input.role,
      modelId: input.model,
      feature: input.feature,
      shop: input.shop,
      status: "ok",
      reasonCode: null,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      latencyMs: this.clock.now() - input.startedAt,
      createdAt: this.clock.now(),
    });
  }

  private async recordFailure(input: {
    role: ModelRole;
    feature: string;
    shop: string | null;
    /** What was tried. `(none)` when the purpose had no chain at all. */
    model: string;
    reason: AiFailureReason;
    startedAt: number;
  }): Promise<void> {
    await this.repo.recordRun({
      role: input.role,
      modelId: input.model,
      feature: input.feature,
      shop: input.shop,
      status: "error",
      reasonCode: input.reason,
      inputTokens: null,
      outputTokens: null,
      latencyMs: this.clock.now() - input.startedAt,
      createdAt: this.clock.now(),
    });
  }
}

/** Anything that is not one of ours is reported as a provider failure. */
function reasonOf(cause: unknown): AiFailureReason {
  return cause instanceof AiError ? cause.reason : "provider";
}
