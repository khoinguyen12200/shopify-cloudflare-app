/**
 * What a model must be GOOD at — not which feature uses it.
 *
 * Grouping by CAPABILITY rather than by feature is the point: a new AI surface
 * picks an existing purpose instead of adding another setting, so this list
 * stays short however many features arrive. Each purpose also fails
 * differently, which is exactly why they are not one setting.
 *
 * Two are wired today (`writing` drafts support replies, `summary` triages a
 * thread). The rest are defined because they are the distinctions the CATALOGUE
 * itself makes — tool calling, thinking traces, price, context — so the console
 * can be configured before the feature that needs it exists. The settings page
 * marks which are actually in use, so nobody mistakes a configured purpose for
 * a running one.
 */
export const MODEL_ROLES = [
  "writing",
  "summary",
  "reasoning",
  "extraction",
  "classification",
] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

/** Plain English for the console, so a purpose never has to be decoded. */
export const ROLE_LABEL: Record<ModelRole, string> = {
  writing: "Writing",
  summary: "Summarising",
  reasoning: "Reasoning and tools",
  extraction: "Extraction",
  classification: "Classification",
};

export const ROLE_DESCRIPTION: Record<ModelRole, string> = {
  writing:
    "Prose a merchant will read — drafted support replies. Wants fluency and room, and must NOT think out loud: a visible reasoning trace in a customer reply is the failure here.",
  summary:
    "Restating facts we already assembled. Nothing is inferred, so the cheapest capable model wins.",
  reasoning:
    "Multi-step questions that must call tools reliably. Needs tool calling and a large context window; this is the expensive purpose.",
  extraction:
    "Free text into a strict shape. Wants a model that does NOT emit a thinking trace — stray prose is what breaks schema parsing.",
  classification:
    "One label from a closed set. The shortest, cheapest job there is; a big model buys nothing.",
};

/** Which purposes a shipped feature actually asks for today. */
export const ROLES_IN_USE: Record<ModelRole, string | null> = {
  writing: "Support reply drafts",
  summary: "Support thread summaries",
  reasoning: null,
  extraction: null,
  classification: null,
};

/** Narrow an untrusted string — a stored row, a form field — to a purpose. */
export function isModelRole(value: string): value is ModelRole {
  return MODEL_ROLES.some((role) => role === value);
}
