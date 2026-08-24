import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import { passwordResetTokens, type PasswordResetToken } from "~/db/schema";

/** The ONLY place `password_reset_tokens` is queried. */
export class PasswordResetTokenRepo {
  async create(input: {
    tokenHash: string;
    adminUserId: string;
    expiresAt: number;
    now: number;
  }): Promise<void> {
    await getDb().insert(passwordResetTokens).values({
      tokenHash: input.tokenHash,
      adminUserId: input.adminUserId,
      expiresAt: input.expiresAt,
      usedAt: null,
      createdAt: input.now,
    });
  }

  /** Lookup is by HASH — the raw token is never stored, so never queried. */
  async findByHash(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const rows = await getDb()
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return rows[0];
  }

  async markUsed(tokenHash: string, now: number): Promise<void> {
    await getDb()
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.tokenHash, tokenHash));
  }

  /**
   * Kill every outstanding token for a user.
   *
   * Called after a successful reset AND after an admin-initiated reset, so any
   * link already sitting in an inbox stops working. Without this, an old email
   * remains a live key to the account.
   */
  async invalidateAllForUser(adminUserId: string, now: number): Promise<void> {
    await getDb()
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.adminUserId, adminUserId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
  }

  /** Live, unused tokens for a user — the throttle reads this. */
  async countActiveForUser(adminUserId: string, now: number): Promise<number> {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.adminUserId, adminUserId),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );
    return Number(row?.count ?? 0);
  }

  /**
   * Delete rows that expired long ago. Used tokens are kept until this runs, so
   * a replay can still be reported accurately rather than looking like a token
   * that never existed. Call from a cron trigger.
   */
  async deleteExpiredBefore(cutoff: number): Promise<number> {
    const deleted = await getDb()
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, cutoff))
      .returning({ tokenHash: passwordResetTokens.tokenHash });
    return deleted.length;
  }
}
