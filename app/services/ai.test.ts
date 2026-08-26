import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AiRepo } from "~/models/ai.server";
import { fakeTextGenerator } from "~/test/fake-ai";
import { AiService } from "./ai.server";
import type { ThreadForPrompt } from "~/ai/draft-prompt";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const AT = 1_700_000_000_000;

const thread: ThreadForPrompt = {
  subject: "Checkout is broken",
  shopName: "Alpha Store",
  category: "bug",
  messages: [{ author: "merchant", authorName: "Alpha Store", body: "It fails at payment." }],
};

const service = (generator = fakeTextGenerator()) =>
  new AiService(new AiRepo(), generator, { now: () => AT });

describe("drafting a support reply", () => {
  it("returns the model's draft", async () => {
    const generator = fakeTextGenerator({ reply: "Sorry about that — which browser?" });
    const result = await inRequest(async () => {
      await new AiRepo().setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
    });

    expect(result).toEqual({ ok: true, value: "Sorry about that — which browser?" });
  });

  it("resolves the WRITING role to the configured model", async () => {
    // The whole point of roles: a feature cannot pin itself to a model that is
    // later retired.
    const generator = fakeTextGenerator();
    await inRequest(async () => {
      await new AiRepo().setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
    });

    expect(generator.only().model).toBe("@cf/x/y");
  });

  it("sends the thread in the prompt", async () => {
    const generator = fakeTextGenerator();
    await inRequest(async () => {
      await new AiRepo().setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
    });

    const user = generator.only().messages.at(-1)?.content ?? "";
    expect(user).toContain("It fails at payment.");
  });

  it("records ONE run row, with the tokens it spent", async () => {
    const generator = fakeTextGenerator({ inputTokens: 111, outputTokens: 222 });
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      await service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
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
      service().draftReply({ thread, shop: "alpha.myshopify.com" }),
    );

    expect(result).toEqual({ ok: false, reason: "no_model" });
  });

  it("still records a run when the model is missing, so the gap is visible", async () => {
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await service().draftReply({ thread, shop: "alpha.myshopify.com" });
      return repo.recentRuns();
    });

    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ status: "error", reasonCode: "no_model" });
  });

  it("turns a provider failure into a Result, never a throw", async () => {
    const generator = fakeTextGenerator({ fail: "provider" });
    const result = await inRequest(async () => {
      await new AiRepo().setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
    });

    expect(result).toEqual({ ok: false, reason: "provider" });
  });

  it("records the failure reason on the run", async () => {
    const generator = fakeTextGenerator({ fail: "timeout" });
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      await service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
      return repo.recentRuns();
    });

    expect(runs[0]).toMatchObject({ status: "error", reasonCode: "timeout" });
  });

  it("refuses an empty draft rather than handing back blank text", async () => {
    // A model that returns whitespace is a failed draft, not a draft.
    const generator = fakeTextGenerator({ reply: "   \n  " });
    const result = await inRequest(async () => {
      await new AiRepo().setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
    });

    expect(result).toEqual({ ok: false, reason: "provider" });
  });

  it("trims the draft, because models like a trailing newline", async () => {
    const generator = fakeTextGenerator({ reply: "  Hello.\n\n" });
    const result = await inRequest(async () => {
      await new AiRepo().setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });
      return service(generator).draftReply({ thread, shop: "alpha.myshopify.com" });
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
      await repo.setModel({ role: "writing", modelId: "@cf/x/y", updatedBy: null, at: AT });

      const started = await service(generator).streamDraftReply({
        thread,
        shop: "alpha.myshopify.com",
      });
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
      service().streamDraftReply({ thread, shop: "alpha.myshopify.com" }),
    );

    expect(result).toEqual({ ok: false, reason: "no_model" });
  });
});

describe("summarising a thread", () => {
  it("resolves the SUMMARY role, not writing", async () => {
    const generator = fakeTextGenerator({ reply: "Payment fails. Waiting on us." });
    await inRequest(async () => {
      await new AiRepo().setModel({ role: "summary", modelId: "@cf/s/m", updatedBy: null, at: AT });
      return service(generator).summariseThread({ thread, shop: "alpha.myshopify.com" });
    });

    expect(generator.only().model).toBe("@cf/s/m");
  });

  it("records its own feature name, so cost is readable per surface", async () => {
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "summary", modelId: "@cf/s/m", updatedBy: null, at: AT });
      await service().summariseThread({ thread, shop: "alpha.myshopify.com" });
      return repo.recentRuns();
    });

    expect(runs[0]?.feature).toBe("support.thread_summary");
  });
});
