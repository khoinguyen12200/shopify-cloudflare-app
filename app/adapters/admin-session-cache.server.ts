import { z } from "zod";
import type { AdminUserPort, SafeAdminUser } from "~/ports/admin-users";

/**
 * Advisory KV cache for the console's per-request "who is signed in" lookup.
 *
 * D1 stays authoritative. Only ACTIVE accounts are ever cached, so the cache can
 * never grant access to an account that was already disabled when it was read.
 * Every write site (disable, role change, delete, rename) deletes the key, and
 * the TTL (KV's 60 s minimum) bounds staleness on colos the delete has not
 * reached yet — that is how long a disabled account can outlive the click.
 */
export const ADMIN_SESSION_CACHE_TTL_SECONDS = 60;

const keyFor = (id: string) => `internal:admin-user:${id}`;

const cachedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["owner", "admin"]),
  status: z.literal("active"),
  notifySupport: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
  lastLoginAt: z.number().nullable(),
});

export interface AdminSessionCache {
  invalidate(id: string): Promise<void>;
}

export function createAdminSessionCache(kv: KVNamespace): AdminSessionCache & {
  read(id: string): Promise<SafeAdminUser | undefined>;
  write(user: SafeAdminUser): Promise<void>;
} {
  return {
    async read(id) {
      const raw = await kv.get(keyFor(id), "json");
      const parsed = cachedUserSchema.safeParse(raw);
      return parsed.success ? parsed.data : undefined;
    },
    async write(user) {
      if (user.status !== "active") return;
      await kv.put(keyFor(user.id), JSON.stringify(user), {
        expirationTtl: ADMIN_SESSION_CACHE_TTL_SECONDS,
      });
    },
    async invalidate(id) {
      await kv.delete(keyFor(id));
    },
  };
}

function logCacheFailure(operation: string, error: unknown): void {
  console.error(
    JSON.stringify({
      event: "admin_session_cache.failed",
      operation,
      error: error instanceof Error ? error.message : "unknown",
    }),
  );
}

/**
 * `findById` that prefers the cache. A cache failure degrades to the D1 read
 * (decoration, never correctness) and is logged.
 */
export function cachedAdminLookup(
  cache: ReturnType<typeof createAdminSessionCache>,
  users: Pick<AdminUserPort, "findById">,
): Pick<AdminUserPort, "findById"> {
  return {
    async findById(id) {
      try {
        const hit = await cache.read(id);
        if (hit) return hit;
      } catch (error) {
        logCacheFailure("read", error);
      }
      const user = await users.findById(id);
      if (user) {
        try {
          await cache.write(user);
        } catch (error) {
          logCacheFailure("write", error);
        }
      }
      return user;
    },
  };
}
