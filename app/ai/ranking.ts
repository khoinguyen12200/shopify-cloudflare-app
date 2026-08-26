import { WORKERS_AI_MODELS, type CatalogueModel } from "./catalogue";
import type { ModelRole } from "./roles";

/**
 * Which models suit a purpose, best first.
 *
 * PURE, and derived entirely from the catalogue's own metadata — tool calling,
 * whether the model thinks out loud, context window, and Cloudflare's published
 * price. Nothing here is a hand-written league table that silently goes stale
 * when a model is retired or repriced; refreshing the catalogue re-ranks
 * everything.
 *
 * It REORDERS, never filters. An admin who knows a model works for their case
 * must still be able to pick it — the ranking is a recommendation, and hiding
 * options would turn it into a rule nobody agreed to.
 *
 * PRICE IS NEVER THE PRIMARY KEY. Ranking on cost first puts the weakest model
 * at the top of every list, which is the wrong default for a draft a merchant
 * will read — the point is a model that does the job well, and only then one
 * that does not overcharge for it. So price breaks ties between models that are
 * equally suited, and decides nothing on its own.
 *
 * These are reasoned picks, not measured ones: the catalogue says a model
 * advertises tool calling, not that it does it well through
 * `workers-ai-provider`. Treat the order as a sane default, not a verdict.
 */

/**
 * Cheaper first — a TIEBREAK only, between models already judged equally
 * suited. Never the first comparator in a chain.
 */
function byPrice(a: CatalogueModel, b: CatalogueModel): number {
  return a.outputMicroUsdPerMTokens - b.outputMicroUsdPerMTokens;
}

/**
 * How capable a model is, in three broad bands.
 *
 * Derived from Cloudflare's published output price, which is the only
 * capability signal the catalogue actually carries: they price by compute, and
 * compute tracks model size. It is a proxy, not a benchmark — but it is a
 * measured one, and it sorts this catalogue the way a person would
 * (llama-3.3-70b and llama-4-scout above llama-3.2-1b and granite-micro).
 *
 * BANDED rather than used raw, deliberately. Raw price descending means "always
 * the most expensive", which is as wrong as "always the cheapest": it would put
 * a 70B model with a 24k window at the top of a purpose that has to read a whole
 * support thread. Bands say "capable enough", then let fit decide.
 */
const STRONG_MICRO_USD = 500_000; // $0.50 per M output tokens
const MID_MICRO_USD = 250_000; // $0.25

function capabilityTier(model: CatalogueModel): number {
  if (model.outputMicroUsdPerMTokens >= STRONG_MICRO_USD) return 2;
  if (model.outputMicroUsdPerMTokens >= MID_MICRO_USD) return 1;
  return 0;
}

/** Stronger band first. */
function byCapability(a: CatalogueModel, b: CatalogueModel): number {
  return capabilityTier(b) - capabilityTier(a);
}

/** Roomiest first. */
function byContext(a: CatalogueModel, b: CatalogueModel): number {
  return b.contextWindow - a.contextWindow;
}

/** Ties break on id so the order is stable run to run. */
function byId(a: CatalogueModel, b: CatalogueModel): number {
  return a.id.localeCompare(b.id);
}

/** `true` sorts first. */
function flagFirst(a: boolean, b: boolean): number {
  return Number(b) - Number(a);
}

type Comparator = (a: CatalogueModel, b: CatalogueModel) => number;

/**
 * One comparator per purpose, in priority order of what that purpose needs.
 *
 * `writing` and `extraction` both rank a thinking trace DOWN, for different
 * reasons: it leaks into a customer's inbox in one, and breaks a schema parse
 * in the other. `reasoning` ranks the same property up. That opposition is why
 * they are separate purposes rather than one "text" setting.
 */
const COMPARATORS: Record<ModelRole, Comparator[]> = {
  writing: [
    // Never think out loud at a customer.
    (a, b) => flagFirst(!a.reasoning, !b.reasoning),
    byCapability,
    // A whole support thread has to fit.
    byContext,
    byPrice,
  ],
  summary: [
    // Same liability as writing: a trace in a summary is noise a human reads.
    (a, b) => flagFirst(!a.reasoning, !b.reasoning),
    byCapability,
    byContext,
    byPrice,
  ],
  reasoning: [
    // Defined by tool calling; a model without it is never the better choice.
    (a, b) => flagFirst(a.toolCalling, b.toolCalling),
    // Here a thinking trace is the capability, not the liability.
    (a, b) => flagFirst(a.reasoning, b.reasoning),
    byCapability,
    byContext,
    byPrice,
  ],
  extraction: [
    // Stray prose breaks the parse, so a quiet model wins over a clever one.
    (a, b) => flagFirst(!a.reasoning, !b.reasoning),
    // Tool calling means it has been trained to emit structured output.
    (a, b) => flagFirst(a.toolCalling, b.toolCalling),
    byCapability,
    byContext,
    byPrice,
  ],
  classification: [
    // A trace around a one-word answer is pure overhead to strip.
    (a, b) => flagFirst(!a.reasoning, !b.reasoning),
    (a, b) => flagFirst(a.toolCalling, b.toolCalling),
    byCapability,
    byContext,
    byPrice,
  ],
};

export function rankModelsForRole(role: ModelRole): CatalogueModel[] {
  const comparators = COMPARATORS[role];

  return [...WORKERS_AI_MODELS].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return byId(a, b);
  });
}

/** How many models a purpose starts with, so a failure has somewhere to go. */
const CHAIN_LENGTH = 3;

/**
 * The chain a purpose starts on — the top of its own ranking.
 *
 * More than one by design: a chain of one is not a chain, and the whole point
 * of the list is that a model failing costs a retry rather than the feature.
 */
export function recommendedChain(role: ModelRole): string[] {
  return rankModelsForRole(role)
    .slice(0, CHAIN_LENGTH)
    .map((model) => model.id);
}
