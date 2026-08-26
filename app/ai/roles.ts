/**
 * What a model must be GOOD at — not which feature uses it.
 *
 * Grouping by CAPABILITY rather than by feature is the whole point: a new AI
 * surface picks an existing role instead of adding another setting, so this
 * stays two rows in the console however many features arrive. Each role also
 * fails differently, which is why they are not one setting: `writing` fails by
 * tone or by leaking a thinking trace into a customer reply, `summary` barely
 * fails at all because the facts are assembled before the model sees them.
 *
 * Pure: a closed union plus its labels, no I/O. Adding a role here makes every
 * `Record<ModelRole, …>` below stop compiling until it is handled.
 */
export const MODEL_ROLES = ["writing", "summary"] as const;

export type ModelRole = (typeof MODEL_ROLES)[number];

/** Plain English for the console, so a role never has to be decoded. */
export const ROLE_LABEL: Record<ModelRole, string> = {
  writing: "Writing",
  summary: "Summarising",
};

export const ROLE_DESCRIPTION: Record<ModelRole, string> = {
  writing:
    "Prose a merchant will read — drafted support replies. Wants fluency, and no visible thinking trace.",
  summary:
    "Restating a thread we already have, for triage. The cheapest capable model wins here.",
};

/** Narrow an untrusted string — a stored row, a form field — to a role. */
export function isModelRole(value: string): value is ModelRole {
  return MODEL_ROLES.some((role) => role === value);
}
