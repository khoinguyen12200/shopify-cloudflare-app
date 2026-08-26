import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AiRepo } from "./ai.server";
import { MODEL_RECOVERY_MS } from "~/ai/chain";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const AT = 1_700_000_000_000;

const add = (repo: AiRepo, modelId: string, role: "writing" | "summary" = "writing") =>
  repo.addToChain({ role, modelId, updatedBy: "sam@x.test", at: AT });

describe("a purpose's chain", () => {
  it("is empty before anything is added", async () => {
    expect(await inRequest(() => new AiRepo().chainFor("writing", AT))).toEqual([]);
  });

  it("keeps models in the order they were added", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await add(repo, "@cf/c/three");
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/a/one", "@cf/b/two", "@cf/c/three"]);
  });

  it("does not move a model that is added twice", async () => {
    // Clicking Add again is not a request to demote it to the end.
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await add(repo, "@cf/a/one");
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/a/one", "@cf/b/two"]);
  });

  it("keeps purposes independent", async () => {
    const both = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/w/w", "writing");
      await add(repo, "@cf/s/s", "summary");
      return {
        writing: await repo.chainFor("writing", AT),
        summary: await repo.chainFor("summary", AT),
      };
    });

    expect(both).toEqual({ writing: ["@cf/w/w"], summary: ["@cf/s/s"] });
  });

  it("lets the same model serve two purposes", async () => {
    const both = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/same/model", "writing");
      await add(repo, "@cf/same/model", "summary");
      return {
        writing: await repo.chainFor("writing", AT),
        summary: await repo.chainFor("summary", AT),
      };
    });

    expect(both.writing).toEqual(["@cf/same/model"]);
    expect(both.summary).toEqual(["@cf/same/model"]);
  });

  it("removes a model from the chain", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.removeFromChain("writing", "@cf/a/one");
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/b/two"]);
  });

  it("moves a model up, swapping with its neighbour", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.reorder({ role: "writing", modelId: "@cf/b/two", direction: "up", at: AT });
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/b/two", "@cf/a/one"]);
  });

  it("moves a model down", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.reorder({ role: "writing", modelId: "@cf/a/one", direction: "down", at: AT });
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/b/two", "@cf/a/one"]);
  });

  it("does nothing when moving past the end", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.reorder({ role: "writing", modelId: "@cf/a/one", direction: "up", at: AT });
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/a/one", "@cf/b/two"]);
  });

  it("drops a model an admin switched off", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.setEnabled({ role: "writing", modelId: "@cf/a/one", enabled: false, at: AT });
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/b/two"]);
  });
});

describe("model health", () => {
  it("demotes a just-failed model to the back, without losing it", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.markHealth({ role: "writing", modelId: "@cf/a/one", healthy: false, at: AT });
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/b/two", "@cf/a/one"]);
  });

  it("trusts it again once the recovery window has passed", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.markHealth({ role: "writing", modelId: "@cf/a/one", healthy: false, at: AT });
      return repo.chainFor("writing", AT + MODEL_RECOVERY_MS + 1);
    });

    expect(chain).toEqual(["@cf/a/one", "@cf/b/two"]);
  });

  it("a success clears a prior failure immediately", async () => {
    // One bad minute must not sideline a model for the whole window.
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await add(repo, "@cf/b/two");
      await repo.markHealth({ role: "writing", modelId: "@cf/a/one", healthy: false, at: AT });
      await repo.markHealth({ role: "writing", modelId: "@cf/a/one", healthy: true, at: AT + 10 });
      return repo.chainFor("writing", AT + 20);
    });

    expect(chain).toEqual(["@cf/a/one", "@cf/b/two"]);
  });

  it("keeps a demoted model when it is the ONLY one", async () => {
    const chain = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/a/one");
      await repo.markHealth({ role: "writing", modelId: "@cf/a/one", healthy: false, at: AT });
      return repo.chainFor("writing", AT);
    });

    expect(chain).toEqual(["@cf/a/one"]);
  });

  it("marks health per purpose, not globally", async () => {
    const both = await inRequest(async () => {
      const repo = new AiRepo();
      await add(repo, "@cf/same/model", "writing");
      await add(repo, "@cf/other/x", "writing");
      await add(repo, "@cf/same/model", "summary");
      await repo.markHealth({ role: "writing", modelId: "@cf/same/model", healthy: false, at: AT });
      return {
        writing: await repo.chainFor("writing", AT),
        summary: await repo.chainFor("summary", AT),
      };
    });

    expect(both.writing).toEqual(["@cf/other/x", "@cf/same/model"]);
    expect(both.summary).toEqual(["@cf/same/model"]);
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
    const totals = await inRequest(async () => {
      const repo = new AiRepo();
      await repo.recordRun(run());
      await repo.recordRun(run({ inputTokens: 5, outputTokens: 7 }));
      return repo.tokensSince(AT - 1);
    });

    expect(totals).toEqual({ input: 15, output: 27, calls: 2 });
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
