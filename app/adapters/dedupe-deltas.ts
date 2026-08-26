import type { LanguageModelV4Middleware, LanguageModelV4StreamPart } from "@ai-sdk/provider";

/**
 * Drops a text delta that is byte-identical to the one immediately before it.
 *
 * WHY THIS EXISTS — a bug in `workers-ai-provider`, not a general precaution.
 * Its stream transform reads two wire shapes in the same pass with no `else`
 * between them:
 *
 *   if (chunk.response != null) enqueue({ type: "text-delta", … })          // Workers AI native
 *   if (chunk.choices?.[0]?.delta?.content) enqueue({ type: "text-delta", … }) // OpenAI-compatible
 *
 * Models that return BOTH fields — several of the newer Workers AI ones do, for
 * compatibility — therefore have every delta emitted twice, and it reaches the
 * reader as "I'veI've already already resolved resolved". `generateText` is
 * unaffected: the non-streaming path calls `extractContent` once and takes a
 * single value, which is why only streaming showed it.
 *
 * There is no provider setting to pick a wire format, so this is applied as SDK
 * middleware — the documented seam — rather than by patching a dependency.
 *
 * THE TRADE-OFF, stated plainly: a model that legitimately emits the same token
 * twice in a row ("ha ha") loses one. That is a rare, one-word imperfection in a
 * draft a human edits before sending, against every reply currently arriving
 * doubled. Only the IMMEDIATE repeat is dropped, so three in a row keep two, and
 * a repeat separated by any other part survives untouched.
 *
 * Delete this the moment the provider ships a fix — `dedupe-deltas.test.ts`
 * documents the exact shape it compensates for.
 */
export const dedupeTextDeltas: LanguageModelV4Middleware = {
  specificationVersion: "v4",

  async wrapStream({ doStream }) {
    const { stream, ...rest } = await doStream();

    let previous: string | null = null;

    const filtered = stream.pipeThrough(
      new TransformStream<LanguageModelV4StreamPart, LanguageModelV4StreamPart>({
        transform(part, controller) {
          if (part.type !== "text-delta") {
            // Anything else resets the comparison, so a repeat that is genuinely
            // separated by other content is never touched.
            previous = null;
            controller.enqueue(part);
            return;
          }

          if (previous !== null && part.delta === previous) {
            // The duplicate. Drop it and forget it, so a third identical delta
            // is emitted rather than swallowed too.
            previous = null;
            return;
          }

          previous = part.delta;
          controller.enqueue(part);
        },
      }),
    );

    return { stream: filtered, ...rest };
  },
};
