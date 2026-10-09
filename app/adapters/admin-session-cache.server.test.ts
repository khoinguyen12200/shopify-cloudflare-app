import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { makeDb } from "~/db/client";
import { adminUsers } from "~/db/schema";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import { createAdmin } from "~/services/admin-management.server";
import {
  createAdminSession,
  getAdminUser,
  requireAdminUser,
  requireOwner,
} from "~/services/admin-auth.server";
import { cachedAdminLookup, createAdminSessionCache } from "./admin-session-cache.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

function deps() {
  const cache = createAdminSessionCache(env.SESSION);
  // Writes go through the authoritative repo, which drops the cache key.
  const fresh = new AdminUserRepo(cache);
  const sessionUsers = cachedAdminLookup(cache, new AdminUserRepo());
  return { cache, fresh, sessionUsers };
}

async function signedIn(role: "owner" | "admin", email: string) {
  const { fresh } = deps();
  const created = await createAdmin(
    { name: "Staff", email, password: "a-long-enough-password", role },
    { users: fresh },
  );
  if (!created.ok) throw new Error(`fixture: ${created.reason}`);
  const response = await createAdminSession(created.value.id, "/internal/dashboard");
  const cookie = response.headers.get("Set-Cookie")?.split(";")[0] ?? "";
  const request = new Request("https://example.test/internal/dashboard", { headers: { Cookie: cookie } });
  return { user: created.value, request };
}

describe("admin session lookup cache", () => {
  it("serves a repeat lookup from KV instead of D1", async () => {
    await inRequest(async () => {
      const { sessionUsers } = deps();
      const { user, request } = await signedIn("admin", "cache-hit@workmanjsc.vn");
      expect((await requireAdminUser(request, { users: sessionUsers })).id).toBe(user.id);

      // Change D1 behind the cache's back: only a cache hit can still see the old name.
      await makeDb(env.DB).update(adminUsers).set({ name: "Changed in D1" }).where(eq(adminUsers.id, user.id));
      expect((await requireAdminUser(request, { users: sessionUsers })).name).toBe("Staff");
    });
  });

  it("a disabled account loses access immediately: the write site invalidates the cache", async () => {
    await inRequest(async () => {
      const { sessionUsers, fresh } = deps();
      const { user, request } = await signedIn("admin", "disabled@workmanjsc.vn");
      expect(await getAdminUser(request, { users: sessionUsers })).toBeDefined(); // warms the cache

      await fresh.setStatus(user.id, "disabled", Date.now());

      expect(await getAdminUser(request, { users: sessionUsers })).toBeUndefined();
      await expect(requireAdminUser(request, { users: sessionUsers })).rejects.toBeInstanceOf(Response);
    });
  });

  it("deleting an account invalidates the cached copy", async () => {
    await inRequest(async () => {
      const { sessionUsers, fresh } = deps();
      const { user, request } = await signedIn("admin", "deleted@workmanjsc.vn");
      await getAdminUser(request, { users: sessionUsers });
      await fresh.remove(user.id);
      expect(await getAdminUser(request, { users: sessionUsers })).toBeUndefined();
    });
  });

  it("never caches an account that is already disabled", async () => {
    await inRequest(async () => {
      const { sessionUsers, fresh, cache } = deps();
      const { user, request } = await signedIn("admin", "never-cached@workmanjsc.vn");
      await fresh.setStatus(user.id, "disabled", Date.now());
      expect(await getAdminUser(request, { users: sessionUsers })).toBeUndefined();
      expect(await cache.read(user.id)).toBeUndefined();
    });
  });

  it("a role change is visible right away and requireOwner keeps answering 403 for admins", async () => {
    await inRequest(async () => {
      const { sessionUsers, fresh } = deps();
      const { user, request } = await signedIn("owner", "demoted@workmanjsc.vn");
      await createAdmin(
        { name: "Other", email: "other-owner@workmanjsc.vn", password: "a-long-enough-password", role: "owner" },
        { users: fresh },
      );
      expect((await requireAdminUser(request, { users: sessionUsers })).role).toBe("owner");

      await fresh.setRole(user.id, "admin", Date.now());

      expect((await requireAdminUser(request, { users: sessionUsers })).role).toBe("admin");
      // requireOwner reads the authoritative repo, never the cache.
      const denied = await requireOwner(request, { users: fresh }).catch((error: unknown) => error);
      expect(denied).toBeInstanceOf(Response);
      expect(denied instanceof Response && denied.status).toBe(403);
    });
  });

  it("degrades to D1 when the cache holds garbage", async () => {
    await inRequest(async () => {
      const { sessionUsers } = deps();
      const { user, request } = await signedIn("admin", "garbage@workmanjsc.vn");
      await env.SESSION.put(`internal:admin-user:${user.id}`, JSON.stringify({ nope: true }));
      expect((await requireAdminUser(request, { users: sessionUsers })).id).toBe(user.id);
    });
  });
});
