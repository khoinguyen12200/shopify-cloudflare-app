const BASE64 = /^[0-9a-zA-Z+/]+={0,2}$/;

/**
 * Whether a `host` query parameter can be handed to Shopify's host sanitiser without it throwing.
 *
 * The library only inspects values that look like base64, and for those it runs `new URL("https://" + atob(host))`
 * unguarded — so a value such as `9998966025409999999` (valid base64, garbage once decoded) throws a TypeError and
 * the request becomes a 500. A value that is not base64 at all is rejected by the library cleanly, so it passes here.
 */
export function isSafeHostParameter(host: string): boolean {
  if (!BASE64.test(host)) return true;
  const decoded = decodeBase64(host);
  return decoded !== null && URL.canParse(`https://${decoded}`);
}

function decodeBase64(value: string): string | null {
  try {
    return atob(value);
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
}
