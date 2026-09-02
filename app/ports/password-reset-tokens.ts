import type { PasswordResetToken } from "~/db/schema";

export interface PasswordResetTokenPort {
  create(input: { tokenHash: string; adminUserId: string; expiresAt: number; now: number }): Promise<void>;
  findByHash(tokenHash: string): Promise<PasswordResetToken | undefined>;
  markUsed(tokenHash: string, now: number): Promise<void>;
  invalidateAllForUser(adminUserId: string, now: number): Promise<void>;
  countActiveForUser(adminUserId: string, now: number): Promise<number>;
}
