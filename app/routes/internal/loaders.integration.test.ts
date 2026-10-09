import { describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import { createAdmin } from "~/services/admin-management.server";
import { createAdminSession, HOME_PATH } from "~/services/admin-auth.server";
import { fakeRuntime } from "~/test/fake-runtime";
import { defined } from "~/test/defined";
import { loader as dashboard } from "./dashboard";
import { loader as shopsIndex } from "./shops/index";
import { loader as shopDetail } from "./shops/detail";
import { loader as subscriptions } from "./subscriptions";
import { loader as supportIndex } from "./support/index";
import { loader as supportDetail } from "./support/detail";
import { loader as supportNew } from "./support/new";
import { loader as adminsIndex } from "./admins/index";
import { loader as adminsReset } from "./admins/reset";
import { loader as ai } from "./ai";
import { loader as mcp } from "./mcp";

/**
 * Every internal page's loader awaits ONLY the auth check and returns its data
 * as promises, so navigation paints the page frame at once. These run the REAL
 * loaders against real local D1 + KV sessions.
 */
setupTestDatabase();

const PASSWORD = "a-long-enough-password";
const authDeps = { users: new AdminUserRepo(), runtime: fakeRuntime() };
const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

async function signedInCookie(email: string, role: "owner" | "admin"): Promise<{ cookie: string; id: string }> {
  const created = await createAdmin({ name: "Test", email, password: PASSWORD, role }, authDeps);
  if (!created.ok) throw new Error(`fixture: ${created.reason}`);
  const response = await createAdminSession(created.value.id, HOME_PATH);
  const header = response.headers.get("Set-Cookie");
  if (!header) throw new Error("expected a Set-Cookie header");
  return { cookie: defined(header.split(";")[0]), id: created.value.id };
}

function args(path: string, cookie: string, params: Record<string, string> = {}) {
  const request = new Request(`https://example.test${path}`, { headers: { Cookie: cookie } });
  return { request, params, context: new RouterContextProvider(), url: new URL(request.url), pattern: path };
}

/** Records whether a promise had settled by the time the caller looked. */
function watch(promise: Promise<unknown>): { settled: () => boolean } {
  let done = false;
  promise.then(
    () => { done = true; },
    () => { done = true; },
  );
  return { settled: () => done };
}

const isPromise = (value: unknown): value is Promise<unknown> => value instanceof Promise;

describe("internal loaders stream their data", () => {
  const pages = [
    { name: "dashboard", path: "/internal/dashboard", run: dashboard, regions: ["headline", "health", "charts"], params: {} },
    { name: "shops", path: "/internal/shops", run: shopsIndex, regions: ["shops"], params: {} },
    { name: "shop detail", path: "/internal/shops/a.myshopify.com", run: shopDetail, regions: ["detail"], params: { shop: "a.myshopify.com" } },
    { name: "subscriptions", path: "/internal/subscriptions", run: subscriptions, regions: ["events"], params: {} },
    { name: "support queue", path: "/internal/support", run: supportIndex, regions: ["tickets"], params: {} },
    { name: "support ticket", path: "/internal/support/t1", run: supportDetail, regions: ["detail"], params: { ticketId: "t1" } },
    { name: "new ticket", path: "/internal/support/new", run: supportNew, regions: ["shops"], params: {} },
    { name: "admins", path: "/internal/admins", run: adminsIndex, regions: ["admins"], params: {} },
    { name: "reset password", path: "/internal/admins/zzz/reset", run: adminsReset, regions: ["target"], params: { adminId: "zzz" } },
    { name: "ai", path: "/internal/ai", run: ai, regions: ["overview"], params: {} },
    { name: "mcp", path: "/internal/mcp", run: mcp, regions: ["access", "auditLogs"], params: {} },
  ] as const;

  for (const page of pages) {
    it(`${page.name}: returns before any data region has settled`, async () => {
      await inRequest(async () => {
        const { cookie } = await signedInCookie("owner@workmanjsc.vn", "owner");
        const data: Record<string, unknown> = await page.run(args(page.path, cookie, page.params));

        const watchers = page.regions.map((region) => {
          const value = data[region];
          if (!isPromise(value)) throw new Error(`${page.name}.${region} must be an un-awaited promise`);
          return watch(value);
        });
        // The loader has returned; D1 I/O cannot have completed synchronously.
        expect(watchers.map((w) => w.settled())).toEqual(page.regions.map(() => false));

        // ...and every region does settle on its own (resolve or reject), so a
        // skeleton can never be stuck forever.
        await Promise.allSettled(page.regions.map((region) => data[region]));
        expect(watchers.map((w) => w.settled())).toEqual(page.regions.map(() => true));
      });
    });
  }

  it("a missing shop, ticket and admin resolve to null, not a thrown error", async () => {
    await inRequest(async () => {
      const { cookie } = await signedInCookie("owner@workmanjsc.vn", "owner");
      const shop = await shopDetail(args("/internal/shops/a.myshopify.com", cookie, { shop: "a.myshopify.com" }));
      const ticket = await supportDetail(args("/internal/support/t1", cookie, { ticketId: "t1" }));
      const target = await adminsReset(args("/internal/admins/zzz/reset", cookie, { adminId: "zzz" }));
      expect(await shop.detail).toBeNull();
      expect(await ticket.detail).toBeNull();
      expect(await target.target).toBeNull();
    });
  });

  it("resetting your own password redirects to the profile before anything streams", async () => {
    await inRequest(async () => {
      const { cookie, id } = await signedInCookie("owner@workmanjsc.vn", "owner");
      const thrown = await adminsReset(args(`/internal/admins/${id}/reset`, cookie, { adminId: id })).then(
        () => null,
        (error: unknown) => error,
      );
      expect(thrown).toBeInstanceOf(Response);
      expect(thrown instanceof Response && thrown.headers.get("Location")).toBe("/internal/profile");
    });
  });
});

describe("owner-only pages still refuse non-owners before rendering anything", () => {
  const ownerOnly = [
    { name: "ai", path: "/internal/ai", run: ai, params: {} },
    { name: "admins", path: "/internal/admins", run: adminsIndex, params: {} },
    { name: "reset password", path: "/internal/admins/zzz/reset", run: adminsReset, params: { adminId: "zzz" } },
  ] as const;

  for (const page of ownerOnly) {
    it(`${page.name}: a signed-in admin gets 403`, async () => {
      await inRequest(async () => {
        await signedInCookie("keeper@workmanjsc.vn", "owner");
        const { cookie } = await signedInCookie("plain@workmanjsc.vn", "admin");
        const thrown = await page.run(args(page.path, cookie, page.params)).then(
          () => null,
          (error: unknown) => error,
        );
        expect(thrown).toBeInstanceOf(Response);
        expect(thrown instanceof Response && thrown.status).toBe(403);
      });
    });

    it(`${page.name}: nobody signed in is sent to login, not shown the page`, async () => {
      await inRequest(async () => {
        const thrown = await page.run(args(page.path, "", page.params)).then(
          () => null,
          (error: unknown) => error,
        );
        expect(thrown).toBeInstanceOf(Response);
        expect(thrown instanceof Response && thrown.status).toBe(302);
      });
    });
  }
});
