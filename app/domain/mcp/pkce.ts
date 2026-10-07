import { timingSafeEqualStr } from "./tokens";

/** URL-safe base64 without padding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Compute the S256 PKCE code challenge from a code verifier. */
export async function computeS256CodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier),
  );
  return toBase64Url(new Uint8Array(digest));
}

export const createCodeChallenge = computeS256CodeChallenge;

/**
 * Verify a PKCE code verifier against a code challenge according to RFC 7636.
 *
 * Supports `S256` (default and strongly recommended) and `plain`.
 */
export async function verifyCodeChallenge({
  codeVerifier,
  codeChallenge,
  method,
}: {
  codeVerifier: string;
  codeChallenge: string;
  method?: string | null;
}): Promise<boolean> {
  if (!codeVerifier || !codeChallenge) return false;

  const challengeMethod = (method || "S256").toUpperCase();
  if (challengeMethod === "S256") {
    const computed = await computeS256CodeChallenge(codeVerifier);
    return timingSafeEqualStr(computed, codeChallenge);
  }

  if (challengeMethod === "PLAIN") {
    return timingSafeEqualStr(codeVerifier, codeChallenge);
  }

  return false;
}
