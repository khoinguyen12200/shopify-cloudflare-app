import type { CatalogueModel } from "~/ai/catalogue";
import { formatMoney, fromMinorUnits, toCurrency } from "~/money";

/**
 * The catalogue's price (micro-USD per million tokens) as USD via `~/money`,
 * rounded to whole cents with integer arithmetic — never `toFixed`.
 */
function outputPrice(model: CatalogueModel): string {
  const usd = toCurrency("USD");
  if (!usd.ok) return "n/a";
  const cents = fromMinorUnits(Math.round(model.outputMicroUsdPerMTokens / 10_000), usd.value);
  return cents.ok ? formatMoney("en-US", cents.value) : "n/a";
}

/** Everything a person needs to judge a model, from the catalogue's own facts. */
export function modelNote(model: CatalogueModel): string {
  const parts = [
    `${Math.round(model.contextWindow / 1000)}k ctx`,
    `${outputPrice(model)}/M out`,
  ];
  if (model.toolCalling) parts.push("tools");
  if (model.reasoning) parts.push("thinks aloud");
  return parts.join(" · ");
}
