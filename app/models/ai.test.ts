import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AiRepo } from "./ai.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const AT = 1_700_000_000_000;

describe("choosing a model for a role", () => {
  it("returns null before anyone has chosen one", async () => {
    expect(await inRequest(() => new AiRepo().modelFor("writing"))).toBeNull();
  });

  it("remembers the choice", async () => {
    const chosen = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/a/b", updatedBy: "sam@x.test", at: AT });
      return repo.modelFor("writing");
    });
    expect(chosen).toBe("@cf/a/b");
  });

  it("REPLACES rather than duplicating when chosen again", async () => {
    // The role is the primary key, so a second choice is an update. Anything
    // else would leave two rows and make the answer order-dependent.
    const { chosen, rows } = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/a/b", updatedBy: null, at: AT });
      await repo.setModel({ role: "writing", modelId: "@cf/c/d", updatedBy: null, at: AT + 1 });
      return { chosen: await repo.modelFor("writing"), rows: await repo.allModels() };
    });

    expect(chosen).toBe("@cf/c/d");
    expect(rows).toHaveLength(1);
  });

  it("keeps roles independent", async () => {
    const both = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/w/w", updatedBy: null, at: AT });
      await repo.setModel({ role: "summary", modelId: "@cf/s/s", updatedBy: null, at: AT });
      return { writing: await repo.modelFor("writing"), summary: await repo.modelFor("summary") };
    });

    expect(both).toEqual({ writing: "@cf/w/w", summary: "@cf/s/s" });
  });

  it("switches a role off again", async () => {
    const after = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/a/b", updatedBy: null, at: AT });
      await repo.clearModel("writing");
      return repo.modelFor("writing");
    });
    expect(after).toBeNull();
  });

  it("records who changed it, for the audit trail", async () => {
    const rows = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.setModel({ role: "writing", modelId: "@cf/a/b", updatedBy: "sam@x.test", at: AT });
      return repo.allModels();
    });
    expect(rows[0]).toMatchObject({ updatedBy: "sam@x.test", updatedAt: AT });
  });
});

describe("the run ledger", () => {
  const run = (over: Partial<Parameters<AiRepo["recordRun"]>[0]> = {}) => ({
    role: "writing" as const,
    modelId: "@cf/a/b",
    feature: "support.reply_draft",
    shop: null,
    status: "ok" as const,
    reasonCode: null,
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 100,
    createdAt: AT,
    ...over,
  });

  it("sums tokens in SQL, not by loading every row", async () => {
    // The ledger grows by one row per call forever; "fetch everything then
    // reduce" works on a fixture and falls over on real data.
    const totals = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.recordRun(run());
      await repo.recordRun(run({ inputTokens: 5, outputTokens: 7 }));
      return repo.tokensSince(AT - 1);
    });

    expect(totals).toEqual({ input: 15, output: 27, calls: 2 });
  });

  it("counts nothing before the window", async () => {
    const totals = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.recordRun(run({ createdAt: AT - 10_000 }));
      return repo.tokensSince(AT);
    });

    expect(totals).toEqual({ input: 0, output: 0, calls: 0 });
  });

  it("returns zeroes rather than NaN when there is nothing at all", async () => {
    expect(await inRequest(() => new AiRepo().tokensSince(0))).toEqual({
      input: 0,
      output: 0,
      calls: 0,
    });
  });

  it("counts a failed run too, so a gap is visible", async () => {
    const totals = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.recordRun(
        run({ status: "error", reasonCode: "no_model", inputTokens: null, outputTokens: null }),
      );
      return repo.tokensSince(AT - 1);
    });

    expect(totals).toEqual({ input: 0, output: 0, calls: 1 });
  });

  it("lists the newest runs first", async () => {
    const runs = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.recordRun(run({ createdAt: AT, feature: "older" }));
      await repo.recordRun(run({ createdAt: AT + 5, feature: "newer" }));
      return repo.recentRuns();
    });

    expect(runs.map((row) => row.feature)).toEqual(["newer", "older"]);
  });
});
