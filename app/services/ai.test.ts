import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AiRepo } from "~/models/ai.server";
import { fakeTextGenerator } from "~/test/fake-ai";
import type { AiFailureReason } from "~/ports/ai";
import type { AiGate } from "~/ai/gate";
import { replyTask } from "~/ai/tasks/reply";
import { threadSummaryTask } from "~/ai/tasks/thread-summary";
import { AiService } from "./ai.server";
import type { ThreadForPrompt } from "~/ai/draft-prompt";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const AT = 1_700_000_000_000;

/** Our own console: never gated by a merchant's plan, and our own spend. */
const STAFF = { surface: "staff", shop: null } as const;
/** The embedded admin, acting for a merchant on their plan. */
const MERCHANT = { surface: "merchant", shop: "alpha.myshopify.com" } as const;

const thread: ThreadForPrompt = {
  subject: "Checkout is broken",
  shopName: "Alpha Store",
  category: "bug",
  messages: [{ author: "merchant", authorName: "Alpha Store", body: "It fails at payment." }],
};

const service = (generator = fakeTextGenerator()) =>
  new AiService({ repo: new AiRepo(), generator, clock: { now: () => AT }, gate: { async refuse() { return null; } } });

describe("drafting a support reply", () => {
  it("uses injected repository chain", async () => {
    const calls: string[] = [];
    const repo = {
      chainFor: async () => { calls.push("chain"); return ["model"]; },
      recordRun: async () => {},
      markHealth: async () => {},
    };
    const result = await new AiService({ repo, generator: fakeTextGenerator({ reply: "Injected." }), clock: { now: () => AT }, gate: { async refuse() { return null; } } }).run(
      replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF,
    );
    expect(result).toEqual({ ok: true, value: "Injected." });
    expect(calls).toEqual(["chain"]);
  });

  it("returns the model's draft", async () => {
    const generator = fakeTextGenerator({ reply: "Sorry about that — which browser?" });
    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(result).toEqual({ ok: true, value: "Sorry about that — which browser?" });
  });

  it("resolves the WRITING purpose to its first model", async () => {
    // The whole point of roles: a feature cannot pin itself to a model that is
    // later retired.
    const generator = fakeTextGenerator();
    await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(generator.only().model).toBe("@cf/x/y");
  });

  it("sends the thread in the prompt", async () => {
    const generator = fakeTextGenerator();
    await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    const user = generator.only().messages.at(-1)?.content ?? "";
    expect(user).toContain("It fails at payment.");
  });

  it("records ONE run row, with the tokens it spent", async () => {
    const generator = fakeTextGenerator({ inputTokens: 111, outputTokens: 222 });
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      await service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      return repo.recentRuns();
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      role: "writing",
      modelId: "@cf/x/y",
      feature: "support.reply_draft",
      status: "ok",
      inputTokens: 111,
      outputTokens: 222,
    });
  });

  it("refuses with no_model when nobody has chosen one for the role", async () => {
    // Degrades to "no draft" — it must never block a reply being sent.
    const result = await inRequest(() =>
      service().run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF),
    );

    expect(result).toEqual({ ok: false, reason: "no_model" });
  });

  it("still records a run when the model is missing, so the gap is visible", async () => {
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await service().run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      return repo.recentRuns();
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "error", reasonCode: "no_model" });
  });

  it("turns a provider failure into a Result, never a throw", async () => {
    const generator = fakeTextGenerator({ fail: "provider" });
    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(result).toEqual({ ok: false, reason: "provider" });
  });

  it("records the failure reason on the run", async () => {
    const generator = fakeTextGenerator({ fail: "timeout" });
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      await service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      return repo.recentRuns();
    });

    expect(runs[0]).toMatchObject({ status: "error", reasonCode: "timeout" });
  });

  it("refuses an empty draft rather than handing back blank text", async () => {
    // A model that returns whitespace is a failed draft, not a draft.
    const generator = fakeTextGenerator({ reply: "   \n  " });
    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(result).toEqual({ ok: false, reason: "provider" });
  });

  it("trims the draft, because models like a trailing newline", async () => {
    const generator = fakeTextGenerator({ reply: "  Hello.\n\n" });
    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(result).toEqual({ ok: true, value: "Hello." });
  });
});

describe("streaming a support reply", () => {
  it("yields chunks and records the run once the stream finishes", async () => {
    const generator = fakeTextGenerator({
      chunks: ["Sorry ", "about ", "that."],
      inputTokens: 5,
      outputTokens: 9,
    });

    const { text, runs } = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });

      const started = await service(generator).stream(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      if (!started.ok) throw new Error(`expected a stream, got ${started.reason}`);

      let text = "";
      for await (const chunk of started.value.textStream) text += chunk;
      // The caller settles the ledger; in a route this is handed to waitUntil.
      await started.value.done;

      return { text, runs: await repo.recentRuns() };
    });

    expect(text).toBe("Sorry about that.");
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "ok", inputTokens: 5, outputTokens: 9 });
  });

  it("refuses before opening a stream when no model is configured", async () => {
    const result = await inRequest(() =>
      service().stream(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF),
    );

    expect(result).toEqual({ ok: false, reason: "no_model" });
  });
});

describe("summarising a thread", () => {
  it("resolves the SUMMARY purpose, not writing", async () => {
    const generator = fakeTextGenerator({ reply: "Payment fails. Waiting on us." });
    await inRequest(async () => {
      await new AiRepo().addToChain({ role: "summary", modelId: "@cf/s/m", updatedBy: null, at: AT });
      return service(generator).run(threadSummaryTask, { thread }, STAFF);
    });

    expect(generator.only().model).toBe("@cf/s/m");
  });

  it("records its own feature name, so cost is readable per surface", async () => {
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.addToChain({ role: "summary", modelId: "@cf/s/m", updatedBy: null, at: AT });
      await service().run(threadSummaryTask, { thread }, STAFF);
      return repo.recentRuns();
    });

    expect(runs[0]?.feature).toBe("support.thread_summary");
  });
});

/**
 * The fallback chain — the reason a purpose is a LIST rather than one model.
 */
describe("falling back down the chain", () => {
  const chain = async (models: string[]) => {
    const repo = new AiRepo();
    for (const modelId of models) {
      await repo.addToChain({ role: "writing", modelId, updatedBy: null, at: AT });
    }
    return repo;
  };

  it("uses the first model when it works", async () => {
    const generator = fakeTextGenerator({ reply: "Draft." });
    await inRequest(async () => {
      await chain(["@cf/a/first", "@cf/b/second"]);
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(generator.calls).toHaveLength(1);
    expect(generator.calls[0]?.model).toBe("@cf/a/first");
  });

  it("falls through to the next model when the first fails", async () => {
    const generator = fakeTextGenerator({
      reply: "Second model's draft.",
      failFor: { "@cf/a/first": "provider" },
    });

    const result = await inRequest(async () => {
      await chain(["@cf/a/first", "@cf/b/second"]);
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(result).toEqual({ ok: true, value: "Second model's draft." });
    expect(generator.calls.map((call) => call.model)).toEqual(["@cf/a/first", "@cf/b/second"]);
  });

  it("walks the whole chain before giving up", async () => {
    const generator = fakeTextGenerator({
      failFor: {
        "@cf/a/first": "provider",
        "@cf/b/second": "timeout",
        "@cf/c/third": "provider",
      },
    });

    const result = await inRequest(async () => {
      await chain(["@cf/a/first", "@cf/b/second", "@cf/c/third"]);
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(generator.calls).toHaveLength(3);
    // The LAST failure is what the caller is told about.
    expect(result).toEqual({ ok: false, reason: "provider" });
  });

  it("does NOT retry a failure that another model cannot fix", async () => {
    // No Workers AI binding is an environment fact, not a model fault. Trying
    // three models re-bills nothing but wastes three round trips.
    const generator = fakeTextGenerator({ fail: "not_configured" });

    const result = await inRequest(async () => {
      await chain(["@cf/a/first", "@cf/b/second", "@cf/c/third"]);
      return service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
    });

    expect(generator.calls).toHaveLength(1);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("demotes the model that failed, so the next request starts on a good one", async () => {
    const generator = fakeTextGenerator({
      reply: "ok",
      failFor: { "@cf/a/first": "provider" },
    });

    const after = await inRequest(async () => {
      const repo = await chain(["@cf/a/first", "@cf/b/second"]);
      await service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      return repo.chainFor("writing", AT);
    });

    expect(after).toEqual(["@cf/b/second", "@cf/a/first"]);
  });

  it("records ONE run row per attempt, so a flaky model is visible", async () => {
    const generator = fakeTextGenerator({
      reply: "ok",
      failFor: { "@cf/a/first": "provider" },
    });

    const runs = await inRequest(async () => {
      const repo = await chain(["@cf/a/first", "@cf/b/second"]);
      await service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      return repo.recentRuns();
    });

    expect(runs).toHaveLength(2);
    expect(runs.map((run) => [run.modelId, run.status])).toEqual([
      ["@cf/b/second", "ok"],
      ["@cf/a/first", "error"],
    ]);
  });

  it("leaves a demoted model demoted when a healthy one answers first", async () => {
    // It is never retried, so nothing clears its failure — it recovers on the
    // window, which is the point of the window.
    const generator = fakeTextGenerator({ reply: "ok" });

    const after = await inRequest(async () => {
      const repo = await chain(["@cf/a/first", "@cf/b/second"]);
      await repo.markHealth({ role: "writing", modelId: "@cf/a/first", healthy: false, at: AT });
      await service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      return repo.chainFor("writing", AT);
    });

    expect(after).toEqual(["@cf/b/second", "@cf/a/first"]);
    expect(generator.only().model).toBe("@cf/b/second");
  });

  it("clears the failure when the demoted model is tried and succeeds", async () => {
    // One model in the chain, so the demoted one IS the candidate. A success
    // must restore it immediately rather than leaving it sidelined.
    const generator = fakeTextGenerator({ reply: "ok" });

    const healthy = await inRequest(async () => {
      const repo = await chain(["@cf/a/only"]);
      await repo.markHealth({ role: "writing", modelId: "@cf/a/only", healthy: false, at: AT });
      await service(generator).run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF);
      const [row] = await repo.allModels();
      return row?.healthy;
    });

    expect(healthy).toBe(true);
  });

  it("refuses with no_model when the purpose has an empty chain", async () => {
    const result = await inRequest(() => service().run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, STAFF));
    expect(result).toEqual({ ok: false, reason: "no_model" });
  });
});

/**
 * The gate — who may use AI at all.
 *
 * Injected as a port, so these prove the USE CASE honours a refusal without
 * needing a plan, a subscription row, or a billing round trip.
 */
describe("gating AI by who is asking", () => {
  const gated = (reason: AiFailureReason | null) => ({
    async refuse() {
      return reason;
    },
  });

  const withGate = (gate: AiGate, generator = fakeTextGenerator()) => ({
    generator,
    service: new AiService({ repo: new AiRepo(), generator, clock: { now: () => AT }, gate }),
  });

  it("refuses when the gate says so", async () => {
    const { service } = withGate(gated("forbidden"));

    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service.run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, MERCHANT);
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("does not spend a token when it refuses", async () => {
    // A gate that runs after the model is not a gate.
    const { service, generator } = withGate(gated("forbidden"));

    await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service.run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, MERCHANT);
    });

    expect(generator.calls).toEqual([]);
  });

  it("still records the refusal, so 'why did nothing happen' has an answer", async () => {
    const { service } = withGate(gated("forbidden"));

    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      await service.run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, MERCHANT);
      return repo.recentRuns();
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({
      status: "error",
      reasonCode: "forbidden",
      shop: MERCHANT.shop,
    });
  });

  it("proceeds when the gate allows", async () => {
    const { service } = withGate(gated(null), fakeTextGenerator({ reply: "Allowed." }));

    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service.run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, MERCHANT);
    });

    expect(result).toEqual({ ok: true, value: "Allowed." });
  });

  it("refuses a stream before it opens", async () => {
    const { service, generator } = withGate(gated("forbidden"));

    const result = await inRequest(async () => {
      await new AiRepo().addToChain({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service.stream(replyTask, { thread, currentText: "hi", instruction: "", tone: "professional" }, MERCHANT);
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
    expect(generator.calls).toEqual([]);
  });

  it("records the merchant's shop on a gated run, not null", async () => {
    // It IS their request, even refused — otherwise a refusal cannot be traced
    // back to the shop that hit it.
    const { service } = withGate(gated("forbidden"));

    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await service.run(replyTask, { thread, currentText: "", instruction: "", tone: "professional" }, MERCHANT);
      return repo.recentRuns();
    });

    expect(runs[0]?.shop).toBe(MERCHANT.shop);
  });
});
