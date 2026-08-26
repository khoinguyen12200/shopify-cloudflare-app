/**
 * Password hashing with PBKDF2 over WebCrypto.
 *
 * WHY NOT BCRYPT: `bcryptjs` is pure JavaScript, so on workerd every round runs
 * as interpreted JS inside the isolate's CPU budget rather than in native code.
 * At cost 12 that is hundreds of milliseconds to over a second of pure compute
 * per attempt, competing with everything else the request does. PBKDF2 is
 * implemented natively by the runtime, so the same security work costs a
 * fraction of the isolate time.
 *
 * Parameters follow OWASP's password-storage guidance for PBKDF2-HMAC-SHA256.
 * The iteration count is stored IN the hash, so it can be raised later without
 * invalidating existing passwords — `needsRehash()` reports which rows to
 * upgrade on next successful login.
 *
 * Format: pbkdf2$sha256$<iterations>$<salt-b64>$<hash-b64>
 * Self-describing on purpose: a bare hash with the parameters in code cannot be
 * migrated.
 */

const ALGORITHM = "pbkdf2";
const DIGEST = "sha256";
/** OWASP's floor for PBKDF2-HMAC-SHA256. Raise it, never lower it. */
export const DEFAULT_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function derive(
  password: string,
  // Uint8Array<ArrayBuffer>, not bare Uint8Array: WebCrypto's BufferSource
  // excludes SharedArrayBuffer-backed views, and TS 6 enforces that.
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
}

/** Hash a password for storage. A fresh random salt every time. */
export async function hashPassword(
  password: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await derive(password, salt, iterations);
  return [
    ALGORITHM,
    DIGEST,
    iterations,
    toBase64(salt),
    toBase64(bits),
  ].join("$");
}

interface ParsedHash {
  iterations: number;
  salt: Uint8Array<ArrayBuffer>;
  hash: Uint8Array<ArrayBuffer>;
}

/** Parse a stored hash. Returns null for anything unrecognised — never throws. */
function parse(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 5) return null;
  const [algorithm, digest, iterationsRaw, saltRaw, hashRaw] = parts;
  if (algorithm !== ALGORITHM || digest !== DIGEST) return null;
  // Narrowed explicitly rather than asserted: `parts.length === 5` above tells
  // the reader these exist, but not the compiler.
  if (saltRaw === undefined || hashRaw === undefined) return null;

  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1) return null;

  try {
    return { iterations, salt: fromBase64(saltRaw), hash: fromBase64(hashRaw) };
  } catch {
    return null;
  }
}

/** Constant-time comparison. A length check first is safe: lengths are public. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  // `?? 0` rather than a non-null assertion; the index is in range by the
  // loop bound, and a missing byte would compare as a difference anyway.
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/**
 * Check a password against a stored hash.
 *
 * Always compares in constant time, and a malformed or empty stored hash simply
 * returns false — never throws, so a corrupt row cannot become a 500 that
 * reveals the account exists.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parsed = parse(stored);
  if (!parsed) return false;

  const bits = await derive(password, parsed.salt, parsed.iterations);
  return timingSafeEqual(new Uint8Array(bits), parsed.hash);
}

/**
 * True when a stored hash was made with weaker parameters than we now use.
 * Re-hash on the next successful login — that is the only moment the plaintext
 * is available.
 */
export function needsRehash(
  stored: string,
  iterations: number = DEFAULT_ITERATIONS,
): boolean {
  const parsed = parse(stored);
  if (!parsed) return true;
  return parsed.iterations < iterations;
}

// The policy lives in its own crypto-free module so the browser can import it.
export {
  MIN_PASSWORD_LENGTH,
  validatePasswordStrength,
} from "./password-policy";
