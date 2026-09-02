import type { AdminRole, AdminStatus, AdminUser, SafeAdminUser } from "~/db/schema";

export interface AdminUserPort {
  findByEmailWithHash(email: string): Promise<AdminUser | undefined>;
  findById(id: string): Promise<SafeAdminUser | undefined>;
  findByIdWithHash(id: string): Promise<AdminUser | undefined>;
  create(input: { id: string; email: string; name: string; passwordHash: string; role: AdminRole; now: number }): Promise<SafeAdminUser>;
  updateProfile(id: string, input: { name: string; now: number }): Promise<void>;
  updatePassword(id: string, passwordHash: string, now: number): Promise<void>;
  recordLogin(id: string, now: number): Promise<void>;
  setStatus(id: string, status: AdminStatus, now: number): Promise<void>;
  setRole(id: string, role: AdminRole, now: number): Promise<void>;
  remove(id: string): Promise<void>;
  countOtherActiveOwners(exceptId: string): Promise<number>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
