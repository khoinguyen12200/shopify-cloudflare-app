export type AdminRole = "owner" | "admin";
export type AdminStatus = "active" | "disabled";
export interface AdminUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly passwordHash: string;
  readonly role: AdminRole;
  readonly status: AdminStatus;
  readonly notifySupport: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastLoginAt: number | null;
}
export type SafeAdminUser = Omit<AdminUser, "passwordHash">;

export interface AdminUserPort {
  list(): Promise<SafeAdminUser[]>;
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
  countAll(): Promise<number>;
  setNotifySupport(id: string, notifySupport: boolean, now: number): Promise<void>;
  supportNotifyRecipients(): Promise<readonly { name: string; email: string }[]>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
