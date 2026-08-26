import { err, ok, type Result } from "~/lib/result";
import { AiRepo } from "~/models/ai.server";
import { buildReplyDraftPrompt, buildThreadSummaryPrompt, type ThreadForPrompt } from "~/ai/draft-prompt";
import type { ModelRole } from "~/ai/roles";
import {
  AiError,
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
  ) {}

  private get ai(): TextGenerator {
    return this.generator ?? defaultGenerator();
  }

  /** Draft the next reply on a support thread. */
  draftReply(input: { thread: ThreadForPrompt; shop: string | null }): Promise<Result<string, AiFailureReason>> {
    return this.generateOnce({
      role: "writing",
      feature: "support.reply_draft",
      shop: input.shop,
      messages: buildReplyDraftPrompt(input.thread),
    });
  }

  /** A two-sentence summary of a thread, for triage. */
  summariseThread(input: { thread: ThreadForPrompt; shop: string | null }): Promise<Result<string, AiFailureReason>> {
    return this.generateOnce({
      role: "summary",
      feature: "support.thread_summary",
      shop: input.shop,
      messages: buildThreadSummaryPrompt(input.thread),
      maxTokens: 200,
    });
  }

  /** The same draft, streamed. Refuses BEFORE opening a stream when it cannot run. */
  async streamDraftReply(input: {
    thread: ThreadForPrompt;
    shop: string | null;
  }): Promise<Result<DraftStream, AiFailureReason>> {
    const startedAt = this.clock.now();
    const role: ModelRole = "writing";
    const feature = "support.reply_draft";

    const model = await this.repo.modelFor(role);
    if (!model) {
      await this.recordFailure({ role, feature, shop: input.shop, reason: "no_model", startedAt });
      return err("no_model");
    }

    let stream: GeneratedStream;
    try {
      stream = await this.ai.stream({ model, messages: buildReplyDraftPrompt(input.thread) });
    } catch (cause) {
      const reason = reasonOf(cause);
      await this.recordFailure({ role, feature, shop: input.shop, reason, startedAt });
      return err(reason);
    }

    return ok({
      textStream: stream.textStream,
      // Settled by the caller. Usage is only known once the stream finishes, so
      // reading it eagerly would meter every streamed call at zero.
      done: stream.usage
        .then((usage) =>
          this.recordSuccess({ role, feature, shop: input.shop, model, usage, startedAt }),
        )
        .catch(async (cause: unknown) => {
          await this.recordFailure({
            role,
            feature,
            shop: input.shop,
            reason: reasonOf(cause),
            startedAt,
          });
        }),
    });
  }

  private async generateOnce(input: {
    role: ModelRole;
    feature: string;
    shop: string | null;
    messages: ReturnType<typeof buildReplyDraftPrompt>;
    maxTokens?: number;
  }): Promise<Result<string, AiFailureReason>> {
    const startedAt = this.clock.now();

    // The role→model decision lives HERE, in the use case, so it is reachable
    // from a test that injects a fake generator.
    const model = await this.repo.modelFor(input.role);
    if (!model) {
      await this.recordFailure({ ...input, reason: "no_model", startedAt });
      return err("no_model");
    }

    try {
      const result = await this.ai.generate({
        model,
        messages: input.messages,
        ...(input.maxTokens === undefined ? {} : { maxTokens: input.maxTokens }),
      });

      const text = result.text.trim();
      if (text === "") {
        // Whitespace is a failed draft, not a draft. Reported as `provider`
        // because that is who produced it.
        await this.recordFailure({ ...input, reason: "provider", startedAt });
        return err("provider");
      }

      await this.recordSuccess({ ...input, model, usage: result.usage, startedAt });
      return ok(text);
    } catch (cause) {
      const reason = reasonOf(cause);
      await this.recordFailure({ ...input, reason, startedAt });
      return err(reason);
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
    reason: AiFailureReason;
    startedAt: number;
  }): Promise<void> {
    // The model may be unknown — that IS the `no_model` failure — so the run is
    // recorded against a placeholder rather than skipped.
    const modelId = (await this.repo.modelFor(input.role)) ?? "(none)";

    await this.repo.recordRun({
      role: input.role,
      modelId,
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
