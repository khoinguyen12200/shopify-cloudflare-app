import { createCookieSessionStorage, redirect } from "react-router";
import { getEnv } from "~/request-context.server";
import { normalizeEmail, type AdminUserPort } from "~/ports/admin-users";
import {
  DEFAULT_ITERATIONS,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "~/lib/password";
import type { AdminRole, SafeAdminUser } from "~/ports/admin-users";

export const LOGIN_PATH = "/internal/login";
export const HOME_PATH = "/internal/dashboard";

/**
 * Session cookie for the internal console.
 *
 * Built per request, not at module load: workerd has no `process.env`, so the
 * signing secret only exists on the `env` binding once a request is in flight.
 */
function sessionStorage() {
  const env = getEnv();
  const secret = env.INTERNAL_SESSION_SECRET;

  // Refuse to run with no secret rather than silently signing with a constant —
  // an unsigned-in-practice session cookie is forgeable, and a default value
  // that ships to production is worse than a crash on boot.
  if (!secret) {
    throw new Error(
      "INTERNAL_SESSION_SECRET is not set. Add it to .dev.vars locally, and " +
        "`wrangler secret put INTERNAL_SESSION_SECRET --env production`.",
    );
  }

  return createCookieSessionStorage({
    cookie: {
      name: "__internal_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [secret],
      // Derived from the app URL, NOT process.env.NODE_ENV — that is undefined
      // on workerd, so the cookie would never be Secure in production.
      secure: (env.SHOPIFY_APP_URL ?? "").startsWith("https://"),
      maxAge: 60 * 60 * 24 * 7,
    },
  });
}

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
  deps: { users: Pick<AdminUserPort, "findByEmailWithHash" | "recordLogin" | "updatePassword"> },
): Promise<LoginResult> {
  const repo = deps.users;
  const user = await repo.findByEmailWithHash(normalizeEmail(email));

  if (!user) {
    await verifyPassword(
      password,
      // A real, parseable hash of an unguessable value, so the work is identical.
      await hashPassword(crypto.randomUUID(), DEFAULT_ITERATIONS),
    );
    return { ok: false, reason: "invalidCredentials" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false, reason: "invalidCredentials" };

  // Check status AFTER the password, so a wrong password on a disabled account
  // does not reveal that the account exists.
  if (user.status !== "active") return { ok: false, reason: "disabled" };

  const now = Date.now();
  await repo.recordLogin(user.id, now);

  // Upgrade opportunistically: this is the only moment the plaintext exists.
  if (needsRehash(user.passwordHash)) {
    await repo.updatePassword(user.id, await hashPassword(password), now);
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
