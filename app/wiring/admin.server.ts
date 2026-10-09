import { cachedAdminLookup, createAdminSessionCache } from "~/adapters/admin-session-cache.server";
import { createAdminSessionCookieStorage } from "~/adapters/admin-session-cookie.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import type { AdminUserPort } from "~/ports/admin-users";
import type { AuthAttemptLimiter } from "~/ports/auth-rate-limit";
import type { PasswordResetTokenPort } from "~/ports/password-reset-tokens";
import { getEnv } from "~/request-context.server";
import type { PasswordResetNotifier } from "~/services/password-reset.server";
import { queuedNotifier } from "~/wiring/notifications.server";

/** The signed cookie store for the internal console's session (per request: the secret lives on `env`). */
export function adminSessionStorage() {
  return createAdminSessionCookieStorage(getEnv());
}

function adminSessionCache() {
  return createAdminSessionCache(getEnv().SESSION);
}

/** Authoritative staff repo (D1). Writes drop the advisory session-lookup cache. */
export function adminUsers(): AdminUserPort {
  return new AdminUserRepo({ invalidate: (id) => adminSessionCache().invalidate(id) });
}

/**
 * Per-request "who is signed in" lookup for the console's guards: KV first, D1
 * on a miss, ≤ 60 s stale after a disable/role change (see admin-session-cache).
 * Never use it for management decisions or `requireOwner` — those read `adminUsers()`.
 */
export function adminSessionUsers(): Pick<AdminUserPort, "findById"> {
  return cachedAdminLookup(adminSessionCache(), new AdminUserRepo());
}

function authLimiter(binding: RateLimit | undefined): AuthAttemptLimiter {
  return {
    async check(key) {
      if (!binding) return "unavailable";
      try {
        const outcome = await binding.limit({ key });
        return outcome.success ? "allowed" : "limited";
      } catch (error) {
        console.error(JSON.stringify({
          event: "auth.rate_limit_unavailable",
          error: error instanceof Error ? error.message : "unknown",
        }));
        return "unavailable";
      }
    },
  };
}

export function authLimiters(): {
  readonly login: AuthAttemptLimiter;
  readonly passwordReset: AuthAttemptLimiter;
} {
  const env = getEnv();
  return {
    login: authLimiter(env.LOGIN_LIMITER),
    passwordReset: authLimiter(env.RESET_LIMITER),
  };
}

export function passwordResetTokens(): PasswordResetTokenPort {
  const repo = new PasswordResetTokenRepo();
  return {
    create: (input) => repo.create(input),
    findByHash: (hash) => repo.findByHash(hash),
    markUsed: (hash, now) => repo.markUsed(hash, now),
    invalidateAllForUser: (id, now) => repo.invalidateAllForUser(id, now),
    countActiveForUser: (id, now) => repo.countActiveForUser(id, now),
  };
}

export function passwordResetNotifier(): PasswordResetNotifier {
  return queuedNotifier();
}
