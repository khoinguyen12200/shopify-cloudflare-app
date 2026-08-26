import { describe, it, expect } from "vitest";
import { streamText, wrapLanguageModel } from "ai";
import { MockLanguageModelV4, simulateReadableStream } from "ai/test";
import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import { dedupeTextDeltas } from "./dedupe-deltas";

const finish: LanguageModelV4StreamPart = {
  type: "finish",
  finishReason: { unified: "stop", raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
};

async function read(parts: LanguageModelV4StreamPart[]): Promise<string> {
  const result = streamText({
    model: wrapLanguageModel({
      model: new MockLanguageModelV4({
        doStream: async () => ({ stream: simulateReadableStream({ chunks: parts }) }),
      }),
      middleware: dedupeTextDeltas,
    }),
    prompt: "x",
  });

  let text = "";
  for await (const chunk of result.textStream) text += chunk;
  return text;
}

const delta = (text: string): LanguageModelV4StreamPart => ({
  type: "text-delta",
  id: "0",
  delta: text,
});

/**
 * `workers-ai-provider` reads BOTH wire shapes in one transform with no `else`:
 * `chunk.response` (Workers AI native) and `chunk.choices[0].delta.content`
 * (OpenAI-compatible). A model that returns both fields therefore has every
 * delta emitted twice, which reaches the merchant as
 * "I'veI've already already resolved resolved". These are that stream.
 */
describe("de-duplicating a double-emitting provider", () => {
  it("collapses the doubling the provider produces", async () => {
    const text = await read([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      delta("I've "), delta("I've "),
      delta("already "), delta("already "),
      delta("resolved "), delta("resolved "),
      { type: "text-end", id: "0" },
      finish,
    ]);

    expect(text).toBe("I've already resolved ");
  });

  it("leaves a well-behaved stream completely alone", async () => {
    const text = await read([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      delta("It "), delta("works "), delta("fine."),
      { type: "text-end", id: "0" },
      finish,
    ]);

    expect(text).toBe("It works fine.");
  });

  it("keeps a repeat that is separated by other text", async () => {
    // "very good very good" is not the bug — the bug is strictly back-to-back.
    const text = await read([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      delta("very "), delta("good "), delta("very "), delta("good"),
      { type: "text-end", id: "0" },
      finish,
    ]);

    expect(text).toBe("very good very good");
  });

  it("does not collapse three of the same in a row down to one", async () => {
    // The bug doubles; it never triples. Dropping only the immediate repeat
    // means a genuine "ha ha ha" keeps two of its three.
    const text = await read([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      delta("ha "), delta("ha "), delta("ha "),
      { type: "text-end", id: "0" },
      finish,
    ]);

    expect(text).toBe("ha ha ");
  });

  it("resets between separate text blocks", async () => {
    const text = await read([
      { type: "stream-start", warnings: [] },
      { type: "text-start", id: "0" },
      delta("one"),
      { type: "text-end", id: "0" },
      { type: "text-start", id: "1" },
      { type: "text-delta", id: "1", delta: "one" },
      { type: "text-end", id: "1" },
      finish,
    ]);

    expect(text).toBe("oneone");
  });

  it("passes an empty stream through", async () => {
    const text = await read([{ type: "stream-start", warnings: [] }, finish]);
    expect(text).toBe("");
  });
});
