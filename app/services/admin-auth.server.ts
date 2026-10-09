import { redirect } from "react-router";
import { adminSessionStorage as sessionStorage } from "~/wiring.server";
import { normalizeEmail, type AdminUserPort } from "~/ports/admin-users";
import {
  DEFAULT_ITERATIONS,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "~/lib/password";
import type { AdminRole, SafeAdminUser } from "~/ports/admin-users";
import type { Runtime } from "~/ports/runtime";

export const LOGIN_PATH = "/internal/login";
export const HOME_PATH = "/internal/dashboard";

const USER_ID_KEY = "adminUserId";

export async function createAdminSession(userId: string, redirectTo: string) {
  const storage = sessionStorage();
  const session = await storage.getSession();
  session.set(USER_ID_KEY, userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await storage.commitSession(session) },
  });
}

export async function destroyAdminSession(request: Request) {
  const storage = sessionStorage();
  const session = await storage.getSession(request.headers.get("Cookie"));
  return redirect(LOGIN_PATH, {
    headers: { "Set-Cookie": await storage.destroySession(session) },
  });
}

/** The signed-in staff user, or undefined. Never throws. */
export async function getAdminUser(
  request: Request,
  deps: { users: Pick<AdminUserPort, "findById"> },
): Promise<SafeAdminUser | undefined> {
  const storage = sessionStorage();
  const session = await storage.getSession(request.headers.get("Cookie"));
  const id = session.get(USER_ID_KEY);
  if (typeof id !== "string") return undefined;

  const user = await deps.users.findById(id);
  // A disabled account must lose access immediately, not at cookie expiry.
  if (!user || user.status !== "active") return undefined;
  return user;
}

/**
 * Guard for every internal route. Throws a redirect when not signed in.
 *
 * `?next=` carries where they were headed so login returns them there.
 */
export async function requireAdminUser(
  request: Request,
  deps: { users: Pick<AdminUserPort, "findById"> },
): Promise<SafeAdminUser> {
  const user = await getAdminUser(request, deps);
  if (!user) {
    const url = new URL(request.url);
    const next = `${url.pathname}${url.search}`;
    throw redirect(
      `${LOGIN_PATH}?next=${encodeURIComponent(next)}`,
      // Clear a stale or disabled session on the way out.
      { headers: { "Set-Cookie": await staleCookie() } },
    );
  }
  return user;
}

async function staleCookie(): Promise<string> {
  const storage = sessionStorage();
  return storage.destroySession(await storage.getSession());
}

/** Staff management requires the `owner` role. */
export async function requireOwner(request: Request, deps: { users: Pick<AdminUserPort, "findById"> }): Promise<SafeAdminUser> {
  const user = await requireAdminUser(request, deps);
  if (user.role !== "owner") {
    // 403, not a redirect: they ARE signed in, they simply may not do this.
    throw new Response("Forbidden", { status: 403 });
  }
  return user;
}

export type LoginResult =
  | { ok: true; user: SafeAdminUser }
  | { ok: false; reason: "invalidCredentials" | "disabled" };

/**
 * Verify credentials.
 *
 * On an unknown email we still run a full hash derivation against a dummy value.
 * Returning early would make "no such user" measurably faster than "wrong
 * password", which is a user-enumeration oracle.
 */
export async function verifyAdminCredentials(
  email: string,
  password: string,
  deps: { users: Pick<AdminUserPort, "findByEmailWithHash" | "recordLogin" | "updatePassword">; runtime: Runtime },
): Promise<LoginResult> {
  const repo = deps.users;
  const user = await repo.findByEmailWithHash(normalizeEmail(email));

  if (!user) {
    await verifyPassword(
      password,
      // A real, parseable hash of an unguessable value, so the work is identical.
      await hashPassword(deps.runtime.ids.uuid(), deps.runtime.randomBytes, DEFAULT_ITERATIONS),
    );
    return { ok: false, reason: "invalidCredentials" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, reason: "invalidCredentials" };

  // Check status AFTER the password, so a wrong password on a disabled account
  // does not reveal that the account exists.
  if (user.status !== "active") return { ok: false, reason: "disabled" };

  const now = deps.runtime.clock.now();
  await repo.recordLogin(user.id, now);

  // Upgrade opportunistically: this is the only moment the plaintext exists.
  if (needsRehash(user.passwordHash)) {
    await repo.updatePassword(user.id, await hashPassword(password, deps.runtime.randomBytes), now);
  }

  const { passwordHash: _ignored, ...safe } = user;
  return { ok: true, user: safe };
}

/** Only same-site paths, so `?next=` can never become an open redirect. */
export function safeRedirectPath(value: unknown, fallback = HOME_PATH): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

export type { AdminRole };
