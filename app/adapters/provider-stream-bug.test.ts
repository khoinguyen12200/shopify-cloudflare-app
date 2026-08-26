import { describe, it, expect } from "vitest";
import { streamText } from "ai";
import { createWorkersAI, type WorkersAISettings } from "workers-ai-provider";

/**
 * A TRIPWIRE, not a feature test.
 *
 * `WorkersAiGenerator.stream()` deliberately does not use the provider's stream
 * path, because that path double-emits every text delta for a model returning
 * both wire shapes. That claim was originally made from READING
 * `workers-ai-provider`'s source; this proves it by running it.
 *
 * The test asserts the CURRENT, BROKEN behaviour. When the provider is fixed it
 * will fail — which is the point: that failure is the signal to delete the
 * workaround in `workers-ai.server.ts` and go back to `streamText`. A limitation
 * nobody is told has been lifted never gets lifted.
 *
 * No network: the Workers AI binding is faked at its own boundary, returning the
 * SSE shape the real service sends.
 */

/** One SSE frame carrying BOTH fields, as several newer Workers AI models do. */
function bothShapes(text: string): string {
  return `data: ${JSON.stringify({
    response: text,
    choices: [{ delta: { content: text } }],
  })}\n\n`;
}

/** A binding that streams the frames above. */
function fakeBinding(frames: readonly string[]) {
  return {
    run: async () =>
      new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          for (const frame of frames) controller.enqueue(encoder.encode(frame));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
  };
}

async function streamThrough(frames: readonly string[]): Promise<string> {
  // Cast the WHOLE options object, not just the binding. The settings type is a
  // union (`{binding}` vs `{accountId, apiKey}`), and a partial-cast leaves
  // TypeScript unable to discriminate the binding variant.
  const workersAi = createWorkersAI({
    binding: fakeBinding(frames),
  } as unknown as WorkersAISettings);

  const result = streamText({ model: workersAi("@cf/any/model"), prompt: "x" });

  let text = "";
  for await (const chunk of result.textStream) text += chunk;
  return text;
}

describe("workers-ai-provider's stream path (pinned, currently broken)", () => {
  it("DOUBLES every delta when a model returns both wire shapes", async () => {
    const text = await streamThrough([bothShapes("I've "), bothShapes("already ")]);

    // If this line starts failing with "I've already ", the provider has been
    // fixed. Delete this file and switch `WorkersAiGenerator.stream()` back to
    // `streamText`.
    expect(text).toBe("I've I've already already ");
  });

  it("is fine when a model returns only the native shape", async () => {
    // Which is why it does not affect every model, and why it was not obvious.
    const nativeOnly = (t: string) => `data: ${JSON.stringify({ response: t })}\n\n`;
    const text = await streamThrough([nativeOnly("clean "), nativeOnly("text")]);

    expect(text).toBe("clean text");
  });
});
