import { describe, it, expect } from "vitest";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { WorkersAiGenerator } from "./workers-ai.server";
import { AiError } from "~/ports/ai";
import type { PromptMessage } from "~/ai/draft-prompt";

const messages: PromptMessage[] = [
  { role: "system", content: "You draft replies." },
  { role: "user", content: "Merchant: it is broken." },
];

/**
 * The adapter, against the AI SDK's OWN mock model.
 *
 * No binding, no network, no tokens — `ai/test` exists precisely so a provider
 * adapter can be exercised for real. The reference implementation this is
 * modelled on has no tests at all over its AI layer, which is how a provider
 * seam quietly stops working.
 */
describe("generating text", () => {
  it("returns the model's text and its token usage", async () => {
    const generator = new WorkersAiGenerator({
      languageModel: () =>
        new MockLanguageModelV4({
          doGenerate: async () => ({
            finishReason: { unified: "stop", raw: "stop" },
            usage: { inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 34, text: 34, reasoning: 0 }, totalTokens: 46 },
            content: [{ type: "text", text: "Sorry about that — which browser?" }],
            warnings: [],
          }),
        }),
    });

    const result = await generator.generate({ model: "@cf/test/model", messages });

    expect(result.text).toBe("Sorry about that — which browser?");
    expect(result.usage).toEqual({
      model: "@cf/test/model",
      inputTokens: 12,
      outputTokens: 34,
    });
  });

  it("sends the system message as a system prompt, not as a user turn", async () => {
    // A system instruction pasted into the user turn is followed far less
    // reliably, and shows up verbatim in the output on some models.
    let seenPrompt: unknown;
    const generator = new WorkersAiGenerator({
      languageModel: () =>
        new MockLanguageModelV4({
          doGenerate: async (options) => {
            seenPrompt = options.prompt;
            return {
              finishReason: { unified: "stop", raw: "stop" },
              usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 }, totalTokens: 2 },
              content: [{ type: "text", text: "ok" }],
              warnings: [],
            };
          },
        }),
    });

    await generator.generate({ model: "@cf/test/model", messages });

    const prompt = seenPrompt as { role: string }[];
    expect(prompt[0]?.role).toBe("system");
    expect(prompt[1]?.role).toBe("user");
  });


  it("fails with not_configured when there is no Workers AI binding", async () => {
    const generator = new WorkersAiGenerator({
      languageModel: undefined,
    });

    await expect(generator.generate({ model: "@cf/test/model", messages })).rejects.toBeInstanceOf(AiError);
  });

  it("turns a provider error into a typed AiError rather than leaking it", async () => {
    const generator = new WorkersAiGenerator({
      languageModel: () =>
        new MockLanguageModelV4({
          doGenerate: async () => {
            throw new Error("upstream exploded");
          },
        }),
    });

    await expect(generator.generate({ model: "@cf/test/model", messages })).rejects.toMatchObject({
      reason: "provider",
    });
  });
});

describe("streaming text", () => {
  it("yields the chunks in order", async () => {
    const parts: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      { type: "text-delta", id: "0", delta: "Sorry " },
      { type: "text-delta", id: "0", delta: "about " },
      { type: "text-delta", id: "0", delta: "that." },
      { type: "text-end", id: "0" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
      },
    ];
    const generator = new WorkersAiGenerator({
      languageModel: () =>
        new MockLanguageModelV4({
          doStream: async () => ({
            stream: simulateReadableStream({ chunks: parts }),
          }),
        }),
    });

    const stream = await generator.stream({ model: "@cf/test/model", messages });

    const chunks: string[] = [];
    for await (const chunk of stream.textStream) chunks.push(chunk);

    expect(chunks.join("")).toBe("Sorry about that.");
  });

  it("resolves usage only AFTER the stream is drained", async () => {
    const parts: LanguageModelV4StreamPart[] = [
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      { type: "text-delta", id: "0", delta: "hi" },
      { type: "text-end", id: "0" },
      {
        type: "finish",
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 7, noCache: 7, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 2, text: 2, reasoning: 0 },
        },
      },
    ];
    // The whole reason `usage` is a promise: a metered surface that read it
    // eagerly would record zero tokens for every streamed call.
    const generator = new WorkersAiGenerator({
      languageModel: () =>
        new MockLanguageModelV4({
          doStream: async () => ({
            stream: simulateReadableStream({ chunks: parts }),
          }),
        }),
    });

    const stream = await generator.stream({ model: "@cf/test/model", messages });
    for await (const _ of stream.textStream) { /* drain */ }

    await expect(stream.usage).resolves.toEqual({
      model: "@cf/test/model",
      inputTokens: 7,
      outputTokens: 2,
    });
  });

});
