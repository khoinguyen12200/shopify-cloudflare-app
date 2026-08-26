import { describe, it, expect } from "vitest";
import { rankModelsForRole, recommendedChain } from "./ranking";
import { findCatalogueModel, WORKERS_AI_MODELS } from "./catalogue";
import { MODEL_ROLES } from "./roles";

const ids = (models: readonly { id: string }[]) => models.map((m) => m.id);

describe("ranking models for a purpose", () => {
  it.each(MODEL_ROLES)("offers every catalogue model for %s, just reordered", (role) => {
    // A ranking that HIDES models would stop an admin picking one we ranked
    // badly but they know works. Order is a recommendation, not a filter.
    const ranked = rankModelsForRole(role);
    expect(ranked).toHaveLength(WORKERS_AI_MODELS.length);
    expect(new Set(ids(ranked))).toEqual(new Set(ids(WORKERS_AI_MODELS)));
  });

  it("puts a NON-reasoning model first for writing", () => {
    // A visible thinking trace in a drafted customer reply is this role's
    // failure mode.
    const [best] = rankModelsForRole("writing");
    expect(best?.reasoning).toBe(false);
  });

  it("puts a NON-reasoning model first for extraction", () => {
    // Stray prose is what breaks schema parsing.
    const [best] = rankModelsForRole("extraction");
    expect(best?.reasoning).toBe(false);
  });

  it("puts a tool-calling model first for reasoning", () => {
    const [best] = rankModelsForRole("reasoning");
    expect(best?.toolCalling).toBe(true);
  });

  it("ranks every tool caller above every non-tool-caller for reasoning", () => {
    // The purpose is defined by tool calling; a model that cannot do it at all
    // is never the better choice, however cheap.
    const ranked = rankModelsForRole("reasoning");
    const firstNonTool = ranked.findIndex((model) => !model.toolCalling);
    if (firstNonTool === -1) return;
    // Everything after the first non-tool-caller must also lack tools.
    for (const model of ranked.slice(firstNonTool)) {
      expect(model.toolCalling, model.id).toBe(false);
    }
  });

  it("does NOT put the cheapest model first for any purpose", () => {
    // Ranking on cost first puts the weakest model at the top of every list.
    // Price is a tiebreak between equally suited models, never the decision.
    const cheapest = [...WORKERS_AI_MODELS].sort(
      (a, b) => a.outputMicroUsdPerMTokens - b.outputMicroUsdPerMTokens,
    )[0];

    for (const role of MODEL_ROLES) {
      expect(rankModelsForRole(role)[0]?.id, role).not.toBe(cheapest?.id);
    }
  });

  it("breaks a genuine tie on price, so equals do not overcharge", () => {
    // Among models that match on every capability the purpose cares about, the
    // cheaper one should come first.
    const ranked = rankModelsForRole("classification");
    for (let i = 1; i < ranked.length; i += 1) {
      const previous = ranked[i - 1];
      const current = ranked[i];
      if (!previous || !current) continue;
      const sameCapabilities =
        previous.reasoning === current.reasoning &&
        previous.toolCalling === current.toolCalling &&
        previous.contextWindow === current.contextWindow;
      if (sameCapabilities) {
        expect(previous.outputMicroUsdPerMTokens).toBeLessThanOrEqual(
          current.outputMicroUsdPerMTokens,
        );
      }
    }
  });

  it("ranks reasoning differently from writing, or the purposes are decoration", () => {
    expect(rankModelsForRole("reasoning")[0]?.id).not.toBe(
      rankModelsForRole("writing")[0]?.id,
    );
  });

  it("is stable — the same purpose always ranks the same way", () => {
    expect(ids(rankModelsForRole("writing"))).toEqual(ids(rankModelsForRole("writing")));
  });
});

describe("the recommended starting chain", () => {
  it.each(MODEL_ROLES)("gives %s more than one model, so fallback has somewhere to go", (role) => {
    expect(recommendedChain(role).length).toBeGreaterThan(1);
  });

  it.each(MODEL_ROLES)("only recommends models that exist in the catalogue for %s", (role) => {
    for (const id of recommendedChain(role)) {
      expect(findCatalogueModel(id), `${role} -> ${id}`).toBeDefined();
    }
  });

  it("never repeats a model within one chain", () => {
    for (const role of MODEL_ROLES) {
      const chain = recommendedChain(role);
      expect(new Set(chain).size, role).toBe(chain.length);
    }
  });

  it("matches the top of that purpose's ranking", () => {
    const ranked = ids(rankModelsForRole("writing")).slice(0, 3);
    expect(recommendedChain("writing")).toEqual(ranked);
  });
});
