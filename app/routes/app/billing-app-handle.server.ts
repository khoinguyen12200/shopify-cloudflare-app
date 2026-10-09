import { z } from "zod";

/**
 * The app's handle builds the hosted pricing-plans link, and it never changes
 * between visits, so it is cached per shop instead of asking Shopify's Admin
 * API on every billing page view. The only write site is `readAppHandle`
 * itself (a cold miss overwrites the key); the TTL bounds staleness if the app
 * is ever renamed. It is decoration: a failure degrades to `null` (no link),
 * logged, and never blocks the page.
 */
export const APP_HANDLE_CACHE_TTL_SECONDS = 60 * 60 * 24;

const cachedHandleSchema = z.object({ handle: z.string().min(1) });

const keyFor = (shop: string) => `billing:app-handle:${shop}`;

export type AppHandleDependencies = {
  readonly kv: KVNamespace;
  readonly shop: string;
  /** Asks Shopify for the app handle; throws on any failure. */
  readonly fetchHandle: () => Promise<string>;
};

async function readCached(kv: KVNamespace, shop: string): Promise<string | null> {
  const parsed = cachedHandleSchema.safeParse(await kv.get(keyFor(shop), "json"));
  return parsed.success ? parsed.data.handle : null;
}

export async function readAppHandle(dependencies: AppHandleDependencies): Promise<string | null> {
  const { kv, shop, fetchHandle } = dependencies;
  try {
    const cached = await readCached(kv, shop);
    if (cached) return cached;
    const handle = await fetchHandle();
    await kv.put(keyFor(shop), JSON.stringify({ handle }), {
      expirationTtl: APP_HANDLE_CACHE_TTL_SECONDS,
    });
    return handle;
  } catch (error) {
    console.error(JSON.stringify({
      event: "billing.app_handle.unavailable",
      shop,
      error: error instanceof Error ? error.message : "unknown",
    }));
    return null;
  }
}
