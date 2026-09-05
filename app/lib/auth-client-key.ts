/** Return the stable client identity used by internal auth limiters. */
export function authClientKey(request: Request): string {
  const address = request.headers.get("CF-Connecting-IP")?.trim();
  return address || "local";
}
