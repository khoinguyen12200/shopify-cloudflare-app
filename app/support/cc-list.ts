import { z } from "zod";
import { err, ok, type Result } from "~/lib/result";

/**
 * The CC list as the merchant builds it, one address at a time.
 *
 * A pure functional core (@rules/design-patterns.md): the modal that adds an
 * address owns no rules, it calls this and renders the reason. That is what
 * makes "is this a duplicate", "is the list full" and "is this an email"
 * testable without a browser, and what stops the same three checks being
 * re-implemented on the new-ticket page and again on the thread page.
 */

/**
 * At most this many CC addresses on a ticket. Every one becomes an outbound
 * send on every reply, so the cap is a bill and a reputation control, not a
 * style preference.
 *
 * Lives here rather than in the schema because it is a domain rule the UI must
 * enforce too — the schema imports it, not the other way round.
 */
export const CC_MAX = 5;

export type CcFailure =
  | "invalid_cc_email"
  | "duplicate_cc_email"
  | "too_many_cc_emails";

/** Lower-cased and trimmed — how an address is compared and how it is stored. */
function normalise(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Add one address, or say why not.
 *
 * The cap is checked BEFORE validity so a merchant at the limit is told the
 * list is full rather than being sent to fix an address that could not be
 * added anyway.
 */
export function addCcEmail(
  current: readonly string[],
  raw: string,
): Result<string[], CcFailure> {
  if (current.length >= CC_MAX) return err("too_many_cc_emails");

  const email = normalise(raw);
  if (!z.string().email().safeParse(email).success) return err("invalid_cc_email");
  if (current.includes(email)) return err("duplicate_cc_email");

  return ok([...current, email]);
}

/** Drop one address. Unknown addresses are a no-op, never an error. */
export function removeCcEmail(
  current: readonly string[],
  email: string,
): string[] {
  const target = normalise(email);
  return current.filter((entry) => entry !== target);
}

/**
 * Whether two CC lists name the same people.
 *
 * This is what decides if the save bar appears, so it has to answer "did the
 * merchant change anything", not "are these two arrays identical". Removing an
 * address and adding it straight back moves it to the end of the list — the
 * order changed, who gets copied did not, and offering to save that would be
 * offering to save nothing.
 *
 * Counted rather than set-compared so a list that somehow holds a duplicate is
 * not reported equal to the same list without it.
 */
export function sameCcList(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;

  const counts = new Map<string, number>();
  for (const entry of a) {
    const key = normalise(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const entry of b) {
    const key = normalise(entry);
    const remaining = counts.get(key) ?? 0;
    if (remaining === 0) return false;
    counts.set(key, remaining - 1);
  }

  return true;
}
