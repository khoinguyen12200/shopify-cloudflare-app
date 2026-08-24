/**
 * Single-use tokens for links sent by email.
 *
 * The token goes in the URL; only its SHA-256 is stored. Two consequences that
 * are the whole point:
 *   • A database leak yields nothing usable.
 *   • Lookup is by hash, so the raw token never has to be queried or compared.
 *
 * PBKDF2 is deliberately NOT used here. Password hashing is slow on purpose
 * because passwords are low-entropy and guessable; a 256-bit random token is
 * not guessable, so a plain digest is correct and fast. Slowness would only add
 * latency to every click.
 */

const TOKEN_BYTES = 32; // 256 bits

/** URL-safe base64 — no padding, no characters that need escaping in a path. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A fresh token. Return it to the caller once; never store it. */
export function generateToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** Hex SHA-256 of a token — what goes in the database. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
