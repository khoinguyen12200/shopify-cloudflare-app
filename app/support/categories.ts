/**
 * What a merchant can file, as a closed union.
 *
 * Keyed by a union type rather than `string` so a new category fails the build
 * everywhere it must be handled — the label maps, the filter, the icon — rather
 * than rendering a raw key to a merchant (@rules/design-patterns.md).
 *
 * The order is the order the picker offers them: the two a merchant most often
 * needs first.
 */
export const SUPPORT_CATEGORIES = [
  "bug",
  "question",
  "feature_request",
  "billing",
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

/**
 * i18n keys for the merchant-facing labels, so the admin surface never holds
 * copy. The internal console is English-only and has its own literal labels.
 */
export const CATEGORY_LABEL_KEY: Record<SupportCategory, `support.category.${SupportCategory}`> = {
  bug: "support.category.bug",
  question: "support.category.question",
  feature_request: "support.category.feature_request",
  billing: "support.category.billing",
};

/** English labels for the internal console (no i18n there — see AGENTS.md). */
export const CATEGORY_LABEL_EN: Record<SupportCategory, string> = {
  bug: "Bug",
  question: "Question",
  feature_request: "Feature request",
  billing: "Billing",
};
