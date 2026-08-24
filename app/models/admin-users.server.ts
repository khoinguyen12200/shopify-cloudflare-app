import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import {
  adminUsers,
  type AdminRole,
  type AdminUser,
  type SafeAdminUser,
} from "~/db/schema";

/** Never let a password hash leave this layer. */
function toSafe(user: AdminUser): SafeAdminUser {
  const { passwordHash: _ignored, ...safe } = user;
  return safe;
}

/** Emails are stored and compared lower-cased, so lookups are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The ONLY place `admin_users` is queried.
 *
 * Unlike every other repo here, this one is not shop-scoped: internal staff are
 * not a merchant's records. See the schema comment.
 */
export class AdminUserRepo {
  /** Includes the hash — for the login path only. */
  async findByEmailWithHash(email: string): Promise<AdminUser | undefined> {
    const rows = await getDb()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizeEmail(email)))
      .limit(1);
    return rows[0];
  }

  async findById(id: string): Promise<SafeAdminUser | undefined> {
    const rows = await getDb()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    return rows[0] ? toSafe(rows[0]) : undefined;
  }

  /** Includes the hash — for verifying a current password before changing it. */
  async findByIdWithHash(id: string): Promise<AdminUser | undefined> {
    const rows = await getDb()
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.id, id))
      .limit(1);
    return rows[0];
  }

  async list(): Promise<SafeAdminUser[]> {
    const rows = await getDb()
      .select()
      .from(adminUsers)
      .orderBy(adminUsers.createdAt);
    return rows.map(toSafe);
  }

  async create(input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    role: AdminRole;
    now: number;
  }): Promise<SafeAdminUser> {
    const [row] = await getDb()
      .insert(adminUsers)
      .values({
        id: input.id,
        email: normalizeEmail(input.email),
        name: input.name.trim(),
        passwordHash: input.passwordHash,
        role: input.role,
        status: "active",
        createdAt: input.now,
        updatedAt: input.now,
      })
      .returning();
    return toSafe(row!);
  }

  async updateProfile(
    id: string,
    input: { name: string; now: number },
  ): Promise<void> {
    await getDb()
      .update(adminUsers)
      .set({ name: input.name.trim(), updatedAt: input.now })
      .where(eq(adminUsers.id, id));
  }

  async updatePassword(
    id: string,
    passwordHash: string,
    now: number,
  ): Promise<void> {
    await getDb()
      .update(adminUsers)
      .set({ passwordHash, updatedAt: now })
      .where(eq(adminUsers.id, id));
  }

  async recordLogin(id: string, now: number): Promise<void> {
    await getDb()
      .update(adminUsers)
      .set({ lastLoginAt: now })
      .where(eq(adminUsers.id, id));
  }

  async setStatus(
    id: string,
    status: "active" | "disabled",
    now: number,
  ): Promise<void> {
    await getDb()
      .update(adminUsers)
      .set({ status, updatedAt: now })
      .where(eq(adminUsers.id, id));
  }

  async setRole(id: string, role: AdminRole, now: number): Promise<void> {
    await getDb()
      .update(adminUsers)
      .set({ role, updatedAt: now })
      .where(eq(adminUsers.id, id));
  }

  async remove(id: string): Promise<void> {
    await getDb().delete(adminUsers).where(eq(adminUsers.id, id));
  }

  async countAll(): Promise<number> {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers);
    return Number(row?.count ?? 0);
  }

  /**
   * Active owners other than `exceptId`.
   *
   * This is the guard against locking everyone out: the last active owner cannot
   * be disabled, demoted, or deleted. Without it, one careless click leaves a
   * console nobody can sign in to and no way back except a manual D1 write.
   */
  async countOtherActiveOwners(exceptId: string): Promise<number> {
    const [row] = await getDb()
      .select({ count: sql<number>`count(*)` })
      .from(adminUsers)
      .where(
        and(
          eq(adminUsers.role, "owner"),
          eq(adminUsers.status, "active"),
          ne(adminUsers.id, exceptId),
        ),
      );
    return Number(row?.count ?? 0);
  }
}
