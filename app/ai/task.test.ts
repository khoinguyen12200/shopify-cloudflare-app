import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AiRepo } from "~/models/ai.server";
import { AiService } from "~/services/ai.server";
import { fakeTextGenerator } from "~/test/fake-ai";
import { z } from "zod";
import { defineAiObjectTask, defineAiTask } from "./task";
import type { AiCaller } from "./gate";
import type { ModelRole } from "./roles";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const AT = 1_700_000_000_000;
const STAFF: AiCaller = { surface: "staff", shop: null };

/**
 * THE EXTENSION TEST.
 *
 * Everything below is what adding a brand-new AI feature to this app costs: one
 * `defineAiTask` and one call. If this test ever needs a change to the service,
 * the adapter, the gate, the ledger or the settings screen to keep passing, the
 * base has stopped being extensible and that is the regression.
 */
const inventedTask = defineAiTask<{ productTitle: string; audience: string }>({
  feature: "catalogue.blurb",
  role: "writing",
  maxTokens: 120,
  buildMessages: ({ productTitle, audience }) => [
    { role: "system", content: "You write one-line product blurbs." },
    { role: "user", content: `Product: ${productTitle}\nAudience: ${audience}` },
  ],
});

const service = (generator = fakeTextGenerator()) =>
  new AiService(new AiRepo(), generator, { now: () => AT });

async function chain(role: ModelRole, models: string[]) {
  const repo = new AiRepo();
  for (const modelId of models) {
    await repo.addToChain({ role, modelId, updatedBy: null, at: AT });
  }
  return repo;
}

describe("adding a new AI feature", () => {
  it("runs with no change to the service", async () => {
    const generator = fakeTextGenerator({ reply: "A tidy little blurb." });

    const result = await inRequest(async () => {
      await chain("writing", ["@cf/a/one"]);
      return service(generator).run(
        inventedTask,
        { productTitle: "Kettle", audience: "campers" },
        STAFF,
      );
    });

    expect(result).toEqual({ ok: true, value: "A tidy little blurb." });
  });

  it("sends the task's own prompt, untouched", async () => {
    const generator = fakeTextGenerator();

    await inRequest(async () => {
      await chain("writing", ["@cf/a/one"]);
      return service(generator).run(inventedTask, { productTitle: "Kettle", audience: "campers" }, STAFF);
    });

    const call = generator.only();
    expect(call.messages[0]?.content).toContain("product blurbs");
    expect(call.messages.at(-1)?.content).toContain("Kettle");
    // The task's own ceiling, not the service default.
    expect(call.maxTokens).toBe(120);
  });

  it("inherits metering without asking for it", async () => {
    const runs = await inRequest(async () => {
      const repo = await chain("writing", ["@cf/a/one"]);
      await service().run(inventedTask, { productTitle: "Kettle", audience: "campers" }, STAFF);
      return repo.recentRuns();
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ feature: "catalogue.blurb", role: "writing", status: "ok" });
  });

  it("inherits the fallback chain without asking for it", async () => {
    const generator = fakeTextGenerator({
      reply: "From the second model.",
      failFor: { "@cf/a/one": "provider" },
    });

    const result = await inRequest(async () => {
      await chain("writing", ["@cf/a/one", "@cf/b/two"]);
      return service(generator).run(inventedTask, { productTitle: "K", audience: "c" }, STAFF);
    });

    expect(result).toEqual({ ok: true, value: "From the second model." });
    expect(generator.calls.map((call) => call.model)).toEqual(["@cf/a/one", "@cf/b/two"]);
  });

  it("inherits the gate without asking for it", async () => {
    const generator = fakeTextGenerator();
    const refuseAll = { async refuse() { return "forbidden" as const; } };

    const result = await inRequest(async () => {
      await chain("writing", ["@cf/a/one"]);
      return new AiService(new AiRepo(), generator, { now: () => AT }, refuseAll).run(
        inventedTask,
        { productTitle: "K", audience: "c" },
        STAFF,
      );
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(generator.calls).toEqual([]);
  });

  it("streams with no change to the service either", async () => {
    const generator = fakeTextGenerator({ chunks: ["A ", "tidy ", "blurb."] });

    const text = await inRequest(async () => {
      await chain("writing", ["@cf/a/one"]);
      const started = await service(generator).stream(
        inventedTask,
        { productTitle: "Kettle", audience: "campers" },
        STAFF,
      );
      if (!started.ok) throw new Error(`expected a stream, got ${started.reason}`);

      let out = "";
      for await (const chunk of started.value.textStream) out += chunk;
      await started.value.done;
      return out;
    });

    expect(text).toBe("A tidy blurb.");
  });

  it("uses whichever purpose it names, so a task picks a capability not a model", async () => {
    const summaryTask = defineAiTask<{ text: string }>({
      feature: "test.summarise",
      role: "summary",
      buildMessages: ({ text }) => [{ role: "user", content: text }],
    });
    const generator = fakeTextGenerator();

    await inRequest(async () => {
      await chain("writing", ["@cf/writing/model"]);
      await chain("summary", ["@cf/summary/model"]);
      return service(generator).run(summaryTask, { text: "hi" }, STAFF);
    });

    expect(generator.only().model).toBe("@cf/summary/model");
  });
});

/**
 * The structured path — what makes `extraction` and `classification` real
 * purposes rather than settings with nothing behind them.
 */
describe("a task that wants a shape, not prose", () => {
  const triageTask = defineAiObjectTask<{ subject: string }, { category: string; urgent: boolean }>({
    feature: "test.triage",
    role: "classification",
    schema: z.object({ category: z.string(), urgent: z.boolean() }),
    buildMessages: ({ subject }) => [
      { role: "system", content: "Classify the ticket." },
      { role: "user", content: subject },
    ],
  });

  it("returns the validated value, typed", async () => {
    const generator = fakeTextGenerator({ object: { category: "bug", urgent: true } });

    const result = await inRequest(async () => {
      await chain("classification", ["@cf/a/one"]);
      return service(generator).runObject(triageTask, { subject: "checkout broken" }, STAFF);
    });

    expect(result).toEqual({ ok: true, value: { category: "bug", urgent: true } });
  });

  it("sends the schema to the model, so decoding is constrained", async () => {
    const generator = fakeTextGenerator({ object: { category: "bug", urgent: false } });

    await inRequest(async () => {
      await chain("classification", ["@cf/a/one"]);
      return service(generator).runObject(triageTask, { subject: "x" }, STAFF);
    });

    const call = generator.only();
    expect(call).toHaveProperty("schema");
  });

  it("REJECTS a value that does not match, rather than handing it on", async () => {
    // The provider saying it matched the schema is not the same as it matching.
    const generator = fakeTextGenerator({ object: { category: "bug", urgent: "yes" } });

    const result = await inRequest(async () => {
      await chain("classification", ["@cf/a/one"]);
      return service(generator).runObject(triageTask, { subject: "x" }, STAFF);
    });

    expect(result).toEqual({ ok: false, reason: "provider" });
  });

  it("falls through to the NEXT model when the shape is wrong", async () => {
    // Re-asking the same model the same question returns the same bad answer
    // and bills for it twice, so the retry has to be a different model.
    const generator = {
      calls: [] as { model: string }[],
      async generate() { throw new Error("unused"); },
      async stream() { throw new Error("unused"); },
      async generateObject(request: { model: string }) {
        generator.calls.push(request);
        return {
          value:
            request.model === "@cf/a/one"
              ? { category: "bug", urgent: "not-a-boolean" }
              : { category: "bug", urgent: true },
          usage: { model: request.model, inputTokens: 1, outputTokens: 1 },
        };
      },
    };

    const result = await inRequest(async () => {
      await chain("classification", ["@cf/a/one", "@cf/b/two"]);
      return new AiService(new AiRepo(), generator, { now: () => AT }).runObject(
        triageTask,
        { subject: "x" },
        STAFF,
      );
    });

    expect(generator.calls.map((call) => call.model)).toEqual(["@cf/a/one", "@cf/b/two"]);
    expect(result).toEqual({ ok: true, value: { category: "bug", urgent: true } });
  });

  it("meters and gates exactly like a text task", async () => {
    const generator = fakeTextGenerator({ object: { category: "bug", urgent: false } });

    const runs = await inRequest(async () => {
      const repo = await chain("classification", ["@cf/a/one"]);
      await service(generator).runObject(triageTask, { subject: "x" }, STAFF);
      return repo.recentRuns();
    });

    expect(runs[0]).toMatchObject({ feature: "test.triage", role: "classification", status: "ok" });
  });
});
