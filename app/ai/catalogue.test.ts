import { describe, it, expect } from "vitest";
import { WORKERS_AI_MODELS, findCatalogueModel, isCatalogueModel } from "./catalogue";

describe("the Workers AI catalogue", () => {
  it("is not empty, or the console offers an empty select", () => {
    expect(WORKERS_AI_MODELS.length).toBeGreaterThan(0);
  });

  it("only lists real Workers AI identifiers", () => {
    // Every id came from `wrangler ai models list --json`; the shape check
    // catches a hand-edit that invents one.
    for (const model of WORKERS_AI_MODELS) {
      expect(model.id, model.id).toMatch(/^@cf\/[a-z0-9._-]+\/[a-z0-9._-]+$/i);
    }
  });

  it("has no duplicate ids", () => {
    const ids = WORKERS_AI_MODELS.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every model a label, a context window and a price", () => {
    for (const model of WORKERS_AI_MODELS) {
      expect(model.label.length, model.id).toBeGreaterThan(0);
      expect(model.contextWindow, model.id).toBeGreaterThan(0);
      // Integer micro-USD, never a float — @rules/money.md applies to a rate
      // as much as to an amount.
      expect(Number.isInteger(model.inputMicroUsdPerMTokens), model.id).toBe(true);
      expect(Number.isInteger(model.outputMicroUsdPerMTokens), model.id).toBe(true);
      expect(model.outputMicroUsdPerMTokens, model.id).toBeGreaterThan(0);
    }
  });

  it("excludes the model kinds that cannot write a support reply", () => {
    // LoRA adapters need config we do not send; guard is a classifier; the code
    // and vision specialists are not for prose.
    for (const model of WORKERS_AI_MODELS) {
      expect(model.id, model.id).not.toMatch(/lora|llama-guard|coder|vision/i);
    }
  });

  it("recognises a listed model and rejects an unlisted one", () => {
    const [first] = WORKERS_AI_MODELS;
    expect(isCatalogueModel(first?.id ?? "")).toBe(true);
    expect(isCatalogueModel("@cf/not/real")).toBe(false);
    expect(findCatalogueModel("@cf/not/real")).toBeUndefined();
  });


});
