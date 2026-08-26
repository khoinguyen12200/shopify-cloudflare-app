import type {
  GenerateRequest,
  GeneratedStream,
  GeneratedText,
  TextGenerator,
} from "~/ports/ai";
import { AiError, type AiFailureReason } from "~/ports/ai";

/**
 * A `TextGenerator` that generates nothing and remembers everything.
 *
 * The fake sits at the PORT — the outermost boundary for this effect. A model
 * call leaves no database state of its own, so recording the request is the
 * only honest way to prove a use case asked for the right role with the right
 * prompt, and `reply` lets a test pin the output without a model.
 */
export interface FakeTextGenerator extends TextGenerator {
  readonly calls: GenerateRequest[];
  /** The single request made. Throws unless there was exactly one. */
  only(): GenerateRequest;
}

export function fakeTextGenerator(options: {
  /** What every call returns. */
  reply?: string;
  /** Chunks for `stream`. Defaults to the whole reply as one chunk. */
  chunks?: readonly string[];
  /** Make every call fail this way instead. */
  fail?: AiFailureReason;
  inputTokens?: number;
  outputTokens?: number;
} = {}): FakeTextGenerator {
  const calls: GenerateRequest[] = [];
  const reply = options.reply ?? "A drafted reply.";
  const usage = {
    model: "@cf/fake/model",
    inputTokens: options.inputTokens ?? 10,
    outputTokens: options.outputTokens ?? 20,
  };

  const refuse = () => {
    if (options.fail) throw new AiError(options.fail, `fake failure: ${options.fail}`);
  };

  return {
    calls,
    only() {
      if (calls.length !== 1) {
        throw new Error(`expected exactly one AI call, got ${calls.length}`);
      }
      const [first] = calls;
      if (!first) throw new Error("unreachable");
      return first;
    },
    async generate(request): Promise<GeneratedText> {
      calls.push(request);
      refuse();
      return { text: reply, usage };
    },
    async stream(request): Promise<GeneratedStream> {
      calls.push(request);
      refuse();
      const chunks = options.chunks ?? [reply];
      return {
        textStream: (async function* () {
          for (const chunk of chunks) yield chunk;
        })(),
        usage: Promise.resolve(usage),
      };
    },
  };
}
