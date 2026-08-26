/**
 * Failure reason → i18n key, as a literal map.
 *
 * A map rather than a template literal (`` t(`support.errors.${reason}`) ``)
 * because `t()` is typed against the `en` files: a template accepts any string
 * and would happily render a missing key as raw text to a merchant, while this
 * fails the build the moment a reason has no message. It also covers reasons
 * that arrive as plain strings from the upload route, where the compiler cannot
 * narrow them for us.
 */
export type SupportErrorKey =
  | "support.errors.rate_limited"
  | "support.errors.not_found"
  | "support.errors.empty_reply"
  | "support.errors.invalid_cc"
  | "support.errors.invalid_cc_email"
  | "support.errors.duplicate_cc_email"
  | "support.errors.too_many_cc_emails"
  | "support.errors.upload_failed"
  | "support.errors.too_large"
  | "support.errors.unsupported_type";

/**
 * Indexed by `string` on purpose, so narrowing an untrusted reason needs no
 * cast — @rules/code-craft.md bans `as`.
 */
const KEYS: Record<string, SupportErrorKey> = {
  rate_limited: "support.errors.rate_limited",
  not_found: "support.errors.not_found",
  empty_reply: "support.errors.empty_reply",
  invalid_cc: "support.errors.invalid_cc",
  // Adding ONE address in the dialog, where the reason names which rule it
  // broke — the merchant can act on each of these where "invalid list" said
  // nothing about what to fix.
  invalid_cc_email: "support.errors.invalid_cc_email",
  duplicate_cc_email: "support.errors.duplicate_cc_email",
  too_many_cc_emails: "support.errors.too_many_cc_emails",
  upload_failed: "support.errors.upload_failed",
  too_large: "support.errors.too_large",
  unsupported_type: "support.errors.unsupported_type",
  // The upload route's "empty" is a failed upload from the merchant's side.
  empty: "support.errors.upload_failed",
};

/**
 * The key for a reason, falling back to the generic upload message for
 * anything unrecognised — a merchant must never be shown a bare reason code.
 */
export function supportErrorKey(reason: string): SupportErrorKey {
  return KEYS[reason] ?? "support.errors.upload_failed";
}
