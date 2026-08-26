import { describe, it, expect } from "vitest";
import { WORKERS_AI_MODELS, findCatalogueModel, isCatalogueModel, DEFAULT_MODEL_FOR_ROLE } from "./catalogue";
import { MODEL_ROLES } from "./roles";

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

  it("gives every model a label and a usable context window", () => {
    for (const model of WORKERS_AI_MODELS) {
      expect(model.label.length, model.id).toBeGreaterThan(0);
      expect(model.contextWindow, model.id).toBeGreaterThan(0);
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

  it("starts every role on a model that is actually in the catalogue", () => {
    // A default naming a retired id would ship the exact failure the catalogue
    // exists to prevent.
    for (const role of MODEL_ROLES) {
      const id = DEFAULT_MODEL_FOR_ROLE[role];
      expect(isCatalogueModel(id), `${role} -> ${id}`).toBe(true);
    }
  });

  it("does not start the writing role on a reasoning model", () => {
    // A visible thinking trace leaking into a drafted customer reply is the
    // failure mode that matters for this role.
    const writing = findCatalogueModel(DEFAULT_MODEL_FOR_ROLE.writing);
    expect(writing?.reasoning).toBe(false);
  });
});
