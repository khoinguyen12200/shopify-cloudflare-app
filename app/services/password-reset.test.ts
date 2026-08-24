import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import { createAdmin } from "./admin-management.server";
import {
  requestPasswordReset,
  checkResetToken,
  completePasswordReset,
  MAX_ACTIVE_TOKENS,
  TOKEN_TTL_MS,
} from "./password-reset.server";
import { hashToken } from "~/lib/token";
import { verifyPassword } from "~/lib/password";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const ORIGIN = "https://example.test";
const OLD_PASSWORD = "the-original-password";

async function seedUser(email = "user@example.com", status: "active" | "disabled" = "active") {
  const created = await createAdmin({
    name: "Test User",
    email,
    password: OLD_PASSWORD,
    role: "admin",
  });
  if (!created.ok) throw new Error(`fixture: ${created.reason}`);
  if (status === "disabled") {
    await new AdminUserRepo().setStatus(created.value.id, "disabled", Date.now());
  }
  return created.value;
}

/**
 * The service reports the token it issued; the ROUTE decides whether a user may
 * see it. Tests read it here so they never depend on that presentation choice.
 */
async function requestFor(email: string) {
  return requestPasswordReset({ email, origin: ORIGIN });
}

describe("requestPasswordReset never reveals whether an account exists", () => {
  it("responds identically for a real and an unknown address", async () => {
    const [real, unknown] = await inRequest(async () => {
      await seedUser("real@example.com");
      return [
        await requestFor("real@example.com"),
        await requestFor("nobody@example.com"),
      ];
    });

    expect(real.requested).toBe(true);
    expect(unknown.requested).toBe(true);
    // No token is issued for an address with no account.
    expect(unknown.token).toBeUndefined();
    expect(real.token).toBeTruthy();
  });

  it("responds the same for a DISABLED account, and issues no token", async () => {
    const outcome = await inRequest(async () => {
      const user = await seedUser("disabled@example.com", "disabled");
      const result = await requestFor("disabled@example.com");
      const active = await new PasswordResetTokenRepo().countActiveForUser(
        user.id,
        Date.now(),
      );
      return { result, active };
    });

    expect(outcome.result.requested).toBe(true);
    expect(outcome.active).toBe(0);
  });

  it("issues no token at all for an unknown address", async () => {
    const rows = await inRequest(async () => {
      await requestFor("nobody@example.com");
      const { results } = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM password_reset_tokens",
      ).all<{ c: number }>();
      return Number(results[0]!.c);
    });
    expect(rows).toBe(0);
  });

  it("matches the account case-insensitively", async () => {
    const result = await inRequest(async () => {
      await seedUser("mixed@example.com");
      return requestFor("MIXED@Example.COM");
    });
    expect(result.token).toBeTruthy();
  });
});

describe("the stored row never contains the token", () => {
  it("stores only a hash", async () => {
    const outcome = await inRequest(async () => {
      await seedUser();
      const result = await requestFor("user@example.com");
      const { results } = await env.DB.prepare(
        "SELECT token_hash FROM password_reset_tokens",
      ).all<{ token_hash: string }>();
      return { token: result.token!, stored: results[0]!.token_hash };
    });

    expect(outcome.stored).not.toBe(outcome.token);
    expect(outcome.stored).not.toContain(outcome.token);
    // And the hash is the one lookup will compute.
    expect(outcome.stored).toBe(await hashToken(outcome.token));
  });
});

describe("throttling", () => {
  it(`stops issuing after ${MAX_ACTIVE_TOKENS} live links`, async () => {
    const issued = await inRequest(async () => {
      const user = await seedUser();
      const tokens: (string | undefined)[] = [];
      for (let i = 0; i < MAX_ACTIVE_TOKENS + 2; i += 1) {
        tokens.push((await requestFor("user@example.com")).token);
      }
      const active = await new PasswordResetTokenRepo().countActiveForUser(
        user.id,
        Date.now(),
      );
      return { tokens, active };
    });

    expect(issued.active).toBe(MAX_ACTIVE_TOKENS);
    // The extra requests still resolve the same way — no error, no hint.
    expect(issued.tokens.filter(Boolean)).toHaveLength(MAX_ACTIVE_TOKENS);
  });
});

describe("checkResetToken", () => {
  it("accepts a fresh token", async () => {
    const checked = await inRequest(async () => {
      await seedUser();
      const { token } = await requestFor("user@example.com");
      return checkResetToken(token!);
    });
    expect(checked.ok).toBe(true);
  });

  it("rejects a token that was never issued", async () => {
    const checked = await inRequest(() => checkResetToken("not-a-real-token"));
    expect(checked).toMatchObject({ ok: false, reason: "invalidToken" });
  });

  it("rejects an EXPIRED token", async () => {
    const checked = await inRequest(async () => {
      const user = await seedUser();
      const token = "expired-token-fixture";
      await new PasswordResetTokenRepo().create({
        tokenHash: await hashToken(token),
        adminUserId: user.id,
        // Already past.
        expiresAt: Date.now() - 1_000,
        now: Date.now() - TOKEN_TTL_MS,
      });
      return checkResetToken(token);
    });
    expect(checked).toMatchObject({ ok: false, reason: "expiredToken" });
  });

  it("distinguishes a USED token from an invalid one", async () => {
    // Two different messages, so clicking an old link twice is not confusing.
    const checked = await inRequest(async () => {
      await seedUser();
      const { token } = await requestFor("user@example.com");
      await completePasswordReset({
        token: token!,
        newPassword: "a-brand-new-password",
        confirmPassword: "a-brand-new-password",
      });
      return checkResetToken(token!);
    });
    expect(checked).toMatchObject({ ok: false, reason: "usedToken" });
  });
});

describe("completePasswordReset", () => {
  it("sets the new password and kills the old one", async () => {
    const outcome = await inRequest(async () => {
      const user = await seedUser();
      const { token } = await requestFor("user@example.com");
      const result = await completePasswordReset({
        token: token!,
        newPassword: "a-brand-new-password",
        confirmPassword: "a-brand-new-password",
      });
      const after = await new AdminUserRepo().findByIdWithHash(user.id);
      return { result, hash: after!.passwordHash };
    });

    expect(outcome.result.ok).toBe(true);
    expect(await verifyPassword("a-brand-new-password", outcome.hash)).toBe(true);
    expect(await verifyPassword(OLD_PASSWORD, outcome.hash)).toBe(false);
  });

  it("is SINGLE USE — the same token cannot be replayed", async () => {
    const second = await inRequest(async () => {
      await seedUser();
      const { token } = await requestFor("user@example.com");
      await completePasswordReset({
        token: token!,
        newPassword: "first-new-password",
        confirmPassword: "first-new-password",
      });
      return completePasswordReset({
        token: token!,
        newPassword: "second-new-password",
        confirmPassword: "second-new-password",
      });
    });
    expect(second).toMatchObject({ ok: false, reason: "usedToken" });
  });

  it("a replay does NOT change the password again", async () => {
    const hash = await inRequest(async () => {
      const user = await seedUser();
      const { token } = await requestFor("user@example.com");
      await completePasswordReset({
        token: token!,
        newPassword: "first-new-password",
        confirmPassword: "first-new-password",
      });
      await completePasswordReset({
        token: token!,
        newPassword: "second-new-password",
        confirmPassword: "second-new-password",
      });
      const after = await new AdminUserRepo().findByIdWithHash(user.id);
      return after!.passwordHash;
    });

    expect(await verifyPassword("first-new-password", hash)).toBe(true);
    expect(await verifyPassword("second-new-password", hash)).toBe(false);
  });

  it("INVALIDATES sibling links still sitting in an inbox", async () => {
    // Request twice, use the second; the first must stop working, or an old
    // email remains a live key to the account.
    const first = await inRequest(async () => {
      await seedUser();
      const a = (await requestFor("user@example.com")).token!;
      const b = (await requestFor("user@example.com")).token!;
      await completePasswordReset({
        token: b,
        newPassword: "chosen-new-password",
        confirmPassword: "chosen-new-password",
      });
      return checkResetToken(a);
    });
    expect(first).toMatchObject({ ok: false, reason: "usedToken" });
  });

  it("refuses an expired token even with a valid password", async () => {
    const result = await inRequest(async () => {
      const user = await seedUser();
      const token = "expired-fixture";
      await new PasswordResetTokenRepo().create({
        tokenHash: await hashToken(token),
        adminUserId: user.id,
        expiresAt: Date.now() - 1,
        now: Date.now() - TOKEN_TTL_MS,
      });
      return completePasswordReset({
        token,
        newPassword: "a-brand-new-password",
        confirmPassword: "a-brand-new-password",
      });
    });
    expect(result).toMatchObject({ ok: false, reason: "expiredToken" });
  });

  it("checks the password policy BEFORE spending the token", async () => {
    // A rejected weak password must leave the link usable — otherwise one typo
    // burns the token and locks the person out again.
    const stillValid = await inRequest(async () => {
      await seedUser();
      const { token } = await requestFor("user@example.com");
      await completePasswordReset({
        token: token!,
        newPassword: "short",
        confirmPassword: "short",
      });
      return checkResetToken(token!);
    });
    expect(stillValid.ok).toBe(true);
  });

  it("refuses a mismatch without spending the token", async () => {
    const outcome = await inRequest(async () => {
      await seedUser();
      const { token } = await requestFor("user@example.com");
      const result = await completePasswordReset({
        token: token!,
        newPassword: "a-brand-new-password",
        confirmPassword: "a-different-password",
      });
      return { result, still: await checkResetToken(token!) };
    });
    expect(outcome.result).toMatchObject({ ok: false, reason: "mismatch" });
    expect(outcome.still.ok).toBe(true);
  });

  it("does not touch another user's password", async () => {
    const otherHash = await inRequest(async () => {
      await seedUser("target@example.com");
      const bystander = await seedUser("bystander@example.com");
      const { token } = await requestFor("target@example.com");
      await completePasswordReset({
        token: token!,
        newPassword: "a-brand-new-password",
        confirmPassword: "a-brand-new-password",
      });
      const after = await new AdminUserRepo().findByIdWithHash(bystander.id);
      return after!.passwordHash;
    });
    expect(await verifyPassword(OLD_PASSWORD, otherHash)).toBe(true);
  });
});

describe("cleanup", () => {
  it("deletes rows that expired before the cutoff", async () => {
    const remaining = await inRequest(async () => {
      const user = await seedUser();
      const repo = new PasswordResetTokenRepo();
      await repo.create({
        tokenHash: await hashToken("old"),
        adminUserId: user.id,
        expiresAt: Date.now() - 10_000,
        now: Date.now() - 20_000,
      });
      await repo.create({
        tokenHash: await hashToken("current"),
        adminUserId: user.id,
        expiresAt: Date.now() + TOKEN_TTL_MS,
        now: Date.now(),
      });
      const deleted = await repo.deleteExpiredBefore(Date.now());
      return { deleted, current: await repo.findByHash(await hashToken("current")) };
    });

    expect(remaining.deleted).toBe(1);
    expect(remaining.current).toBeDefined();
  });
});
