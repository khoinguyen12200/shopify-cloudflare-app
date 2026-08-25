/**
 * How much of a message a notification preview carries. Long enough to answer
 * "do I need to look at this now?", short enough for a phone's subject preview.
 */
export const EXCERPT_MAX = 140;

const PLACEHOLDER = "(no message)";

/**
 * A one-line preview of a message, for an email body or a queue row.
 *
 * Whitespace is collapsed first: a pasted stack trace is legitimate ticket
 * content and would otherwise turn a preview into forty blank lines. The
 * placeholder exists because a reply can be a screenshot with no words at all,
 * and an empty preview reads as a broken email rather than as an attachment.
 *
 * Truncation happens HERE and not in a template: where to cut is one decision,
 * and leaving it to each renderer means every channel invents its own length.
 */
export function excerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat === "") return PLACEHOLDER;
  if (flat.length <= EXCERPT_MAX) return flat;
  // Total length stays at the cap, ellipsis included.
  return `${flat.slice(0, EXCERPT_MAX - 1)}…`;
}
