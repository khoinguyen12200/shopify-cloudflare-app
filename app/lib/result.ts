// ─────────────────────────────────────────────────────────────────────────────
// `Result` — an EXPECTED failure as a value, not an exception.
//
// `throw` is for programmer error and broken invariants. A malformed amount from
// an external API, a password that is too short, a record that is not there —
// those are ordinary outcomes, and a caller that must handle them should be told
// so by the type rather than by a comment.
//
// The reason is a CLOSED UNION per call site, never a string: the reason usually
// ends up stored, logged, or turned into a message, and a free string means the
// reader recovers meaning by pattern-matching its own vocabulary.
// ─────────────────────────────────────────────────────────────────────────────

export type Result<T, E extends string> =
  | { ok: true; value: T }
  | { ok: false; reason: E; detail?: string };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E extends string>(
  reason: E,
  detail?: string,
): { ok: false; reason: E; detail?: string } {
  return detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };
}

/**
 * Unwrap, throwing on failure.
 *
 * For a value you have ALREADY proven valid — a literal in a test, a constant in
 * a seed. Never for external input: reaching for this in a request path converts
 * a handled outcome back into a 500, which is the thing `Result` exists to stop.
 */
export function unwrap<T, E extends string>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(
    `unwrap() on a failed Result: ${result.reason}${result.detail ? ` — ${result.detail}` : ""}`,
  );
}
