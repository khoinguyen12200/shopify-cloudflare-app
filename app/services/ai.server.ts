import { err, ok, type Result } from "~/lib/result";
import { AiRepo } from "~/models/ai.server";
import type { AiTask } from "~/ai/task";
import { allowAll, type AiCaller, type AiGate } from "~/ai/gate";
import type { ModelRole } from "~/ai/roles";
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
 * RUN AN AI TASK. One method for every feature, and two for streaming.
 *
 * Everything a feature would otherwise have to remember lives here exactly once:
 *
 *   gate → resolve the purpose's chain → try candidates → meter every attempt
 *        → write health back → return a Result
 *
 * A new feature is a `defineAiTask` file and a call. It cannot forget the gate,
 * cannot skip the ledger, and cannot pin itself to a model — because none of
 * those are its job.
 *
 * Two properties hold for every task, by construction:
 *
 * **AI degrades, never blocks.** Every path returns a `Result`, never throws. A
 * missing model, a refused caller or a dead provider costs the feature and
 * nothing else (@rules/data.md: degrade decoration, never correctness).
 *
 * **Every call is metered.** One `ai_runs` row per attempt including refusals
 * and failures, because tokens are what cost money and a gap that leaves no row
 * looks exactly like a feature nobody used.
 */

interface Clock {
  now(): number;
}

const systemClock: Clock = { now: () => Date.now() };

/** A stream, plus the promise that settles the ledger once it drains. */
export interface AiStream {
  readonly textStream: AsyncIterable<string>;
  /** Hand this to `waitUntil` — it records the run and never rejects. */
  readonly done: Promise<void>;
}

/** Built per request, not at module load: the binding comes from the request env. */
function defaultGenerator(): TextGenerator {
  return new WorkersAiGenerator({ languageModel: workersAiModelFactory() });
}

export class AiService {
  constructor(
    private readonly repo = new AiRepo(),
    private readonly generator?: TextGenerator,
    private readonly clock: Clock = systemClock,
    /**
     * Who may use AI. `allowAll` in the base — the policy is an app's own
     * decision, plugged in here or composed with `composeGates`. See
     * `~/ai/gate`; nothing in this file knows what a plan is.
     */
    private readonly gate: AiGate = allowAll,
  ) {}

  private get ai(): TextGenerator {
    return this.generator ?? defaultGenerator();
  }

  /** Run a task to completion. */
  async run<Input>(
    task: AiTask<Input>,
    input: Input,
    caller: AiCaller,
  ): Promise<Result<string, AiFailureReason>> {
    const refusal = await this.refused(task, caller);
    if (refusal) return err(refusal);

    const messages = task.buildMessages(input);
    const chain = await this.repo.chainFor(task.role, this.clock.now());
    if (chain.length === 0) {
      await this.record({ task, caller, model: "(none)", reason: "no_model", startedAt: this.clock.now() });
      return err("no_model");
    }

    let last: AiFailureReason = "provider";

    for (const model of chain) {
      const startedAt = this.clock.now();

      try {
        const result = await this.ai.generate({
          model,
          messages,
          ...(task.maxTokens === undefined ? {} : { maxTokens: task.maxTokens }),
        });

        const text = result.text.trim();
        if (text === "") {
          // Whitespace is a failed answer, not an answer — and another model may
          // well produce words, so it is worth the retry.
          last = "provider";
          await this.afterFailure({ task, caller, model, reason: last, startedAt });
          continue;
        }

        await this.afterSuccess({ task, caller, model, usage: result.usage, startedAt });
        return ok(text);
      } catch (cause) {
        last = reasonOf(cause);
        await this.afterFailure({ task, caller, model, reason: last, startedAt });
        // Nothing another model can do about it.
        if (!isRetriable(last)) return err(last);
      }
    }

    // Chain exhausted: the caller hears about the last thing that went wrong.
    return err(last);
  }

  /**
   * Run a task as a stream.
   *
   * Falls forward through the chain only while OPENING. Once the first byte has
   * reached the client, swapping models would splice two different answers
   * together, so a mid-stream failure ends the stream instead.
   */
  async stream<Input>(
    task: AiTask<Input>,
    input: Input,
    caller: AiCaller,
  ): Promise<Result<AiStream, AiFailureReason>> {
    const refusal = await this.refused(task, caller);
    if (refusal) return err(refusal);

    const startedAt = this.clock.now();
    const messages = task.buildMessages(input);
    const chain = await this.repo.chainFor(task.role, this.clock.now());
    if (chain.length === 0) {
      await this.record({ task, caller, model: "(none)", reason: "no_model", startedAt });
      return err("no_model");
    }

    let opened: GeneratedStream | null = null;
    let model = "";
    let last: AiFailureReason = "provider";

    for (const candidate of chain) {
      try {
        opened = await this.ai.stream({
          model: candidate,
          messages,
          ...(task.maxTokens === undefined ? {} : { maxTokens: task.maxTokens }),
        });
        model = candidate;
        break;
      } catch (cause) {
        last = reasonOf(cause);
        await this.afterFailure({ task, caller, model: candidate, reason: last, startedAt });
        if (!isRetriable(last)) return err(last);
      }
    }

    if (!opened) return err(last);
    const stream = opened;

    return ok({
      textStream: stream.textStream,
      // Usage is only known once the stream finishes, so reading it eagerly
      // would meter every streamed call at zero.
      done: stream.usage
        .then((usage) => this.afterSuccess({ task, caller, model, usage, startedAt }))
        .catch(async (cause: unknown) => {
          await this.afterFailure({ task, caller, model, reason: reasonOf(cause), startedAt });
        }),
    });
  }

  /**
   * The gate, checked ONCE and before any model is resolved.
   *
   * Ahead of the chain deliberately: a refusal that arrives after the spend is
   * not a gate. It still leaves a ledger row, so "why did nothing happen" has
   * an answer.
   */
  private async refused<Input>(
    task: AiTask<Input>,
    caller: AiCaller,
  ): Promise<AiFailureReason | null> {
    const reason = await this.gate.refuse({ caller, role: task.role });
    if (!reason) return null;

    await this.record({ task, caller, model: "(gated)", reason, startedAt: this.clock.now() });
    return reason;
  }

  private async afterSuccess<Input>(input: {
    task: AiTask<Input>;
    caller: AiCaller;
    model: string;
    usage: AiUsage;
    startedAt: number;
  }): Promise<void> {
    await this.repo.recordRun({
      role: input.task.role,
      modelId: input.model,
      feature: input.task.feature,
      shop: input.caller.shop,
      status: "ok",
      reasonCode: null,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      latencyMs: this.clock.now() - input.startedAt,
      createdAt: this.clock.now(),
    });

    // Clears a prior failure, so one bad minute does not sideline a model for
    // the whole recovery window.
    await this.repo.markHealth({
      role: input.task.role,
      modelId: input.model,
      healthy: true,
      at: this.clock.now(),
    });
  }

  private async afterFailure<Input>(input: {
    task: AiTask<Input>;
    caller: AiCaller;
    model: string;
    reason: AiFailureReason;
    startedAt: number;
  }): Promise<void> {
    await this.record(input);

    // Only the model is demoted, and only for a failure it can be blamed for.
    if (isRetriable(input.reason)) {
      await this.repo.markHealth({
        role: input.task.role,
        modelId: input.model,
        healthy: false,
        at: this.clock.now(),
      });
    }
  }

  private record<Input>(input: {
    task: AiTask<Input>;
    caller: AiCaller;
    model: string;
    reason: AiFailureReason;
    startedAt: number;
  }): Promise<void> {
    return this.repo.recordRun({
      role: input.task.role,
      modelId: input.model,
      feature: input.task.feature,
      shop: input.caller.shop,
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

export type { ModelRole };
