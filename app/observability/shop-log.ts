export type ShopLogFields = Readonly<Record<string, string | number | boolean | null>>;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Stable tenant identifier for logs; the shop domain itself never leaves this function. */
export async function hashShop(shop: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(shop));
  return toHex(new Uint8Array(digest));
}

/** Emit structured tenant-safe logs with a consistent event and shop hash shape. */
export async function shopLog(event: string, shop: string, fields: ShopLogFields = {}): Promise<void> {
  const safeFields = Object.fromEntries(
    Object.entries(fields).filter(([key]) => !/^(event|shop|shopHash|payload|token|secret)$/i.test(key)),
  );
  console.log(JSON.stringify({ event, shopHash: await hashShop(shop), ...safeFields }));
}
