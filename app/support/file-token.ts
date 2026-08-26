/**
 * Short-lived, per-attachment access tokens for `/support/file/:id`.
 *
 * WHY this exists rather than just authenticating the request: an embedded
 * Shopify app authenticates with a session token that only its own `fetch`
 * calls can carry. A plain `<img src="/support/file/…">` inside the admin
 * iframe is a browser subresource request — no `Authorization` header, and no
 * usable cookie — so `authenticate.admin` cannot recognise it and the image
 * never renders. (In the internal console the same URL works, because that
 * surface really does use a session cookie.)
 *
 * So the authorisation moves into the URL. The loader has already proven, with
 * a real session, that this shop owns this attachment; it mints a token saying
 * so, and the file route verifies the token instead of the request.
 *
 * The signed payload is `attachmentId:expiresAt`, so a token is useless for any
 * other attachment and stops working on its own. Pure by signature — the
 * secret and the current time are arguments, never ambient reads
 * (@rules/code-craft.md), which is what makes every branch here testable.
 */

/** How long a minted URL stays usable. Long enough to read a thread, not to share. */
export const ATTACHMENT_TOKEN_TTL_MS = 60 * 60 * 1000;

/** URL-safe base64, no padding — the token lands in a query string. */
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
}

/**
 * A token authorising ONE attachment until `expiresAt`.
 *
 * The expiry travels in the clear and is also inside the signed payload, so
 * editing it to buy more time invalidates the signature.
 */
export async function signAttachmentToken({
  secret,
  attachmentId,
  expiresAt,
}: {
  secret: string;
  attachmentId: string;
  expiresAt: number;
}): Promise<string> {
  const signature = await sign(secret, `${attachmentId}:${expiresAt}`);
  return `${expiresAt}.${signature}`;
}

/** Constant-time comparison. A length check first is safe: lengths are public. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  // `?? 0` rather than a non-null assertion: the index is in range by the
  // loop bound, and @rules/code-craft.md has no exception for "obviously safe".
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Whether `token` authorises `attachmentId` right now.
 *
 * The signature is compared in constant time rather than with `===`: a string
 * compare returns early on the first wrong byte, which leaks how much of a
 * guessed signature was right. Same helper shape as `~/lib/password.ts`, for
 * the same reason.
 */
export async function verifyAttachmentToken({
  secret,
  attachmentId,
  token,
  now,
}: {
  secret: string;
  attachmentId: string;
  token: string;
  now: number;
}): Promise<boolean> {
  const separator = token.indexOf(".");
  if (separator <= 0) return false;

  const expiryText = token.slice(0, separator);
  const presented = token.slice(separator + 1);
  if (presented.length === 0) return false;

  // `Number` on a non-numeric string is NaN, and every comparison against NaN
  // is false — so this is checked explicitly rather than relied upon.
  const expiresAt = Number(expiryText);
  if (!Number.isSafeInteger(expiresAt)) return false;
  if (now > expiresAt) return false;

  const expected = await sign(secret, `${attachmentId}:${expiresAt}`);
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(expected), encoder.encode(presented));
}
