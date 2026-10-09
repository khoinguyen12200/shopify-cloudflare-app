/**
 * Token generation, hashing, prefixing, and constant-time comparison.
 *
 * All operations are pure WebCrypto-compatible functions.
 */

import type { RandomBytes } from "~/ports/runtime";

export const TOKEN_PREFIXES = {
  pat: "sc_pat_",
  accessToken: "sc_tok_",
  refreshToken: "sc_ref_",
  clientId: "mcp_cid_",
  clientSecret: "mcp_sec_",
  authCode: "mcp_code_",
} as const;

/** URL-safe base64 without padding. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time comparison between two strings to prevent timing attacks. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i += 1) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

/** Hex-encoded SHA-256 digest of any string. */
export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Helper to generate random raw token with a prefix and its display prefix. */
function createRawToken(prefix: string, randomBytes: RandomBytes, randomBytesCount = 32): { raw: string; displayPrefix: string } {
  const raw = `${prefix}${toBase64Url(randomBytes(randomBytesCount))}`;
  // Display prefix is prefix + first 6 chars of entropy
  const displayPrefix = raw.slice(0, prefix.length + 6);
  return { raw, displayPrefix };
}

/** Generate a Personal Access Token (PAT). */
export async function generatePat(randomBytes: RandomBytes): Promise<{ raw: string; hash: string; prefix: string }> {
  const { raw, displayPrefix } = createRawToken(TOKEN_PREFIXES.pat, randomBytes, 32);
  const hash = await sha256(raw);
  return { raw, hash, prefix: displayPrefix };
}

/** Generate an OAuth Access Token (typically 1h TTL). */
export async function generateAccessToken(randomBytes: RandomBytes): Promise<{ raw: string; hash: string; prefix: string }> {
  const { raw, displayPrefix } = createRawToken(TOKEN_PREFIXES.accessToken, randomBytes, 32);
  const hash = await sha256(raw);
  return { raw, hash, prefix: displayPrefix };
}

/** Generate an OAuth Refresh Token. */
export async function generateRefreshToken(randomBytes: RandomBytes): Promise<{ raw: string; hash: string; prefix: string }> {
  const { raw, displayPrefix } = createRawToken(TOKEN_PREFIXES.refreshToken, randomBytes, 32);
  const hash = await sha256(raw);
  return { raw, hash, prefix: displayPrefix };
}

/** Generate a unique OAuth Client ID. */
export function generateClientId(randomBytes: RandomBytes): string {
  return `${TOKEN_PREFIXES.clientId}${toBase64Url(randomBytes(16))}`;
}

/** Generate a Client Secret for confidential OAuth clients. */
export async function generateClientSecret(randomBytes: RandomBytes): Promise<{ raw: string; hash: string; prefix: string }> {
  const { raw, displayPrefix } = createRawToken(TOKEN_PREFIXES.clientSecret, randomBytes, 32);
  const hash = await sha256(raw);
  return { raw, hash, prefix: displayPrefix };
}

/** Generate a one-time OAuth Authorization Code (10m TTL). */
export async function generateAuthCode(randomBytes: RandomBytes): Promise<{ raw: string; hash: string }> {
  const raw = `${TOKEN_PREFIXES.authCode}${toBase64Url(randomBytes(24))}`;
  const hash = await sha256(raw);
  return { raw, hash };
}

/** Check if token has expired. */
export function isTokenExpired(expiresAt: number | null | undefined, now: number): boolean {
  if (expiresAt === null || expiresAt === undefined) return false;
  return now >= expiresAt;
}

/** Check if token is revoked. */
export function isTokenRevoked(revokedAt: number | null | undefined): boolean {
  return revokedAt !== null && revokedAt !== undefined;
}
