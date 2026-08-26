import {
  generateObject,
  generateText,
  jsonSchema,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { getEnv } from "~/request-context.server";
import {
  AiError,
  type GenerateObjectRequest,
  type GenerateRequest,
  type GeneratedObject,
  type GeneratedStream,
  type GeneratedText,
  type TextGenerator,
} from "~/ports/ai";
import type { PromptMessage } from "~/ai/draft-prompt";

/**
 * The Workers AI adapter, over the Vercel AI SDK.
 *
 * Both seams are INJECTED — the model factory and the role→model lookup — which
 * is what lets the whole adapter run against the SDK's own `MockLanguageModelV3`
 * with no binding, no network and no tokens. That is the difference between an
 * AI provider you can test and one you can only read.
 *
 * The SDK is here rather than `env.AI.run()` directly for one reason worth
 * stating: it normalises streaming, usage accounting and message shape across
 * providers, so moving off Workers AI later is a change to this file only.
 */

const DEFAULT_MAX_TOKENS = 700;
const TIMEOUT_MS = 30_000;

export interface WorkersAiOpts {
  /** Absent = no Workers AI binding, which is the normal local-dev state. */
  languageModel?: (id: string) => LanguageModel;
  timeoutMs?: number;
}

/**
 * The SDK wants the system instruction as its own field, not as a message.
 * Passing it as a user turn is followed far less reliably and, on some models,
 * is echoed back verbatim in the output.
 */
function split(messages: readonly PromptMessage[]): {
  system: string | undefined;
  prompt: ModelMessage[];
} {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const prompt: ModelMessage[] = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({ role: "user", content: message.content }));

  return { system: system === "" ? undefined : system, prompt };
}

export function workersAiModelFactory(): ((id: string) => LanguageModel) | undefined {
  // `AI` is optional in the type because a deploy without the binding must fail
  // as "not configured" rather than at module load.
  const env = getEnv();
  const binding = env.AI;
  if (!binding) return undefined;

  // Optional: set it and every call gains caching, cost tracking and logs.
  const gateway = env.AI_GATEWAY_ID;
  const workersAi = createWorkersAI({
    binding,
    ...(gateway ? { gateway: { id: gateway } } : {}),
  });

  return (id: string) => workersAi(id);
}

export class WorkersAiGenerator implements TextGenerator {
  constructor(private readonly opts: WorkersAiOpts) {}

  /** Dumb by design: no lookup, no policy — just the model it was handed. */
  private model(id: string): LanguageModel {
    const factory = this.opts.languageModel;
    if (!factory) {
      throw new AiError("not_configured", "The Workers AI binding is not available.");
    }
    return factory(id);
  }

  async generate(request: GenerateRequest): Promise<GeneratedText> {
    const model = this.model(request.model);
    const id = request.model;
    const { system, prompt } = split(request.messages);

    try {
      const result = await generateText({
        model,
        system,
        messages: prompt,
        maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        abortSignal: AbortSignal.timeout(this.opts.timeoutMs ?? TIMEOUT_MS),
      });

      return {
        text: result.text,
        usage: {
          model: id,
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
        },
      };
    } catch (cause) {
      throw asAiError(cause);
    }
  }

  /** Ask for a value of a known shape. */
  async generateObject(request: GenerateObjectRequest): Promise<GeneratedObject> {
    const model = this.model(request.model);
    const { system, prompt } = split(request.messages);

    try {
      const result = await generateObject({
        model,
        system,
        messages: prompt,
        // `jsonSchema` wraps a plain JSON Schema for the SDK, so the adapter
        // never needs to know Zod.
        schema: jsonSchema(request.schema),
        maxOutputTokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        abortSignal: AbortSignal.timeout(this.opts.timeoutMs ?? TIMEOUT_MS),
      });

      return {
        value: result.object,
        usage: {
          model: request.model,
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
        },
      };
    } catch (cause) {
      throw asAiError(cause);
    }
  }

  /**
   * Stream a generation.
   *
   * Deliberately built on `generate`, NOT on the SDK's `streamText`, and this is
   * the one place in the app that needs explaining.
   *
   * `workers-ai-provider`'s stream transform reads two wire shapes in the same
   * pass with no `else` between them — `chunk.response` (Workers AI native) and
   * `chunk.choices[0].delta.content` (OpenAI-compatible). A model that returns
   * BOTH fields, as several of the newer Workers AI ones do, therefore has every
   * delta emitted twice, and it reaches the reader as "I'veI've already
   * already". Its non-streaming path has no such problem: it calls
   * `extractContent` once and takes a single value.
   *
   * So the text comes from the path that is correct by construction, and is then
   * handed to the caller over the streaming interface. The honest consequence:
   * today the answer arrives complete rather than token by token. That is a
   * slower first word in exchange for a correct one, which for a support draft a
   * human edits is not a close call.
   *
   * Nothing above this method knows. When the provider is fixed, this becomes
   * `streamText(...)` again and the port, the service, the route and the client
   * are all untouched — which is exactly why the seam is here and not in a
   * filter over someone else's broken output.
   */
  async stream(request: GenerateRequest): Promise<GeneratedStream> {
    const generated = await this.generate(request);

    return {
      textStream: (async function* () {
        yield generated.text;
      })(),
      // Already known, because the generation has finished. The port keeps this
      // a promise for a provider that genuinely streams.
      usage: Promise.resolve(generated.usage),
    };
  }
}

/** Never let a provider's own error shape escape the adapter. */
function asAiError(cause: unknown): AiError {
  if (cause instanceof AiError) return cause;
  const message = cause instanceof Error ? cause.message : String(cause);
  if (cause instanceof Error && cause.name === "TimeoutError") {
    return new AiError("timeout", message);
  }
  return new AiError("provider", message);
}
