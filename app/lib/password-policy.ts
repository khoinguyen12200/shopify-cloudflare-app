/**
 * Password policy — deliberately in its own module with NO crypto and no I/O.
 *
 * Both the server (to enforce) and the browser (to show the rule and set
 * `minLength`) need these. Importing them from a `.server` module would drag
 * that whole module into the client bundle, which the build rejects outright.
 */

/**
 * Length is the only requirement that reliably correlates with strength;
 * composition rules mostly push people toward `Password1!`. NIST recommends a
 * length minimum and no forced composition.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Returns a translation-key suffix, or null when the password is acceptable. */
export function validatePasswordStrength(password: string): "tooShort" | null {
  if (password.length < MIN_PASSWORD_LENGTH) return "tooShort";
  // Reject whitespace padding used to reach the length.
  if (password.trim().length < MIN_PASSWORD_LENGTH) return "tooShort";
  return null;
}
