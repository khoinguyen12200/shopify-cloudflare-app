import { hashPassword, verifyPassword } from "~/lib/password";
import { validatePasswordStrength } from "~/lib/password-policy";
import { AdminUserRepo, normalizeEmail } from "~/models/admin-users.server";
import type { AdminRole, SafeAdminUser } from "~/db/schema";

/**
 * Staff management use cases. Pure decisions plus repo calls — every guard that
 * protects the console from being locked out lives here, once, so no route can
 * forget one.
 *
 * Expected failures are returned as a `Result`, never thrown
 * (@rules/code-craft.md). The reason strings are translation keys under
 * `internal.admins.errors` / `internal.profile.errors`.
 */
/**
 * Every failure this module can report. A CLOSED union, not `string`: the routes
 * build a translation key from it (`admins.errors.${reason}`), and the typed
 * `t()` only accepts a key it can prove exists. A stray reason is a build error
 * rather than a raw key path rendered to a user.
 */
export type AdminErrorReason =
  | "nameRequired"
  | "emailInvalid"
  | "emailTaken"
  | "tooShort"
  | "notFound"
  | "lastOwner"
  | "notYourself"
  | "forbidden";

/** Same closed-union treatment for the messages on the profile page. */
export type ProfileErrorReason =
  | "nameRequired"
  | "wrongPassword"
  | "mismatch"
  | "tooShort"
  | "sameAsOld"
  | "notFound";

export type Result<T, E extends string = AdminErrorReason> =
  | { ok: true; value: T }
  | { ok: false; reason: E };

const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });
const fail = <E extends string>(reason: E): { ok: false; reason: E } => ({
  ok: false,
  reason,
});

/** Deliberately permissive: real validation is "can it receive mail", not a regex. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function createAdmin(input: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}): Promise<Result<SafeAdminUser>> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);

  if (!name) return fail("nameRequired");
  if (!looksLikeEmail(email)) return fail("emailInvalid");

  const weak = validatePasswordStrength(input.password);
  if (weak) return fail("tooShort");

  const repo = new AdminUserRepo();
  // Checked here for a good error message; the DB's unique index is the real
  // guarantee against a race.
  if (await repo.findByEmailWithHash(email)) return fail("emailTaken");

  try {
    const user = await repo.create({
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      now: Date.now(),
    });
    return ok(user);
  } catch {
    // The unique index fired — someone else created it in between.
    return fail("emailTaken");
  }
}

/**
 * Disable an account.
 *
 * Two guards: you cannot disable yourself (that is an instant self-lockout), and
 * you cannot disable the last active owner (that locks out *everyone*, with no
 * way back except a manual database write).
 */
export async function setAdminStatus(input: {
  actorId: string;
  targetId: string;
  status: "active" | "disabled";
}): Promise<Result<SafeAdminUser>> {
  if (input.actorId === input.targetId) return fail("notYourself");

  const repo = new AdminUserRepo();
  const target = await repo.findById(input.targetId);
  if (!target) return fail("notFound");

  if (input.status === "disabled" && target.role === "owner") {
    const others = await repo.countOtherActiveOwners(target.id);
    if (others === 0) return fail("lastOwner");
  }

  await repo.setStatus(target.id, input.status, Date.now());
  return ok({ ...target, status: input.status });
}

/** Change a role. Demoting the last active owner is refused, for the same reason. */
export async function setAdminRole(input: {
  actorId: string;
  targetId: string;
  role: AdminRole;
}): Promise<Result<SafeAdminUser>> {
  if (input.actorId === input.targetId) return fail("notYourself");

  const repo = new AdminUserRepo();
  const target = await repo.findById(input.targetId);
  if (!target) return fail("notFound");

  if (target.role === "owner" && input.role !== "owner") {
    const others = await repo.countOtherActiveOwners(target.id);
    if (others === 0) return fail("lastOwner");
  }

  await repo.setRole(target.id, input.role, Date.now());
  return ok({ ...target, role: input.role });
}

/** Delete an account outright. Same two guards as disabling. */
export async function removeAdmin(input: {
  actorId: string;
  targetId: string;
}): Promise<Result<SafeAdminUser>> {
  if (input.actorId === input.targetId) return fail("notYourself");

  const repo = new AdminUserRepo();
  const target = await repo.findById(input.targetId);
  if (!target) return fail("notFound");

  if (target.role === "owner") {
    const others = await repo.countOtherActiveOwners(target.id);
    if (others === 0) return fail("lastOwner");
  }

  await repo.remove(target.id);
  return ok(target);
}

/**
 * An owner resets someone ELSE's password.
 *
 * This is the recovery path that always ends up being needed: without it, an
 * admin who forgets their password cannot be helped except by writing to the
 * database by hand.
 *
 * Deliberately NOT allowed on your own account — use `changeOwnPassword`, which
 * requires the current password. Letting this path target yourself would turn a
 * borrowed session into a permanent takeover with no knowledge of the old
 * password.
 *
 * There is no email delivery here: the new password is returned once so the
 * owner can hand it over out of band, and it is never stored in plaintext or
 * logged. Wire a "must change on next sign-in" flag if you want to force
 * rotation.
 */
export async function resetAdminPassword(input: {
  actorId: string;
  targetId: string;
  newPassword: string;
}): Promise<Result<{ user: SafeAdminUser }>> {
  if (input.actorId === input.targetId) return fail("notYourself");

  const weak = validatePasswordStrength(input.newPassword);
  if (weak) return fail("tooShort");

  const repo = new AdminUserRepo();
  const target = await repo.findById(input.targetId);
  if (!target) return fail("notFound");

  await repo.updatePassword(
    target.id,
    await hashPassword(input.newPassword),
    Date.now(),
  );
  return ok({ user: target });
}

export async function updateOwnProfile(input: {
  userId: string;
  name: string;
}): Promise<Result<null, ProfileErrorReason>> {
  const name = input.name.trim();
  if (!name) return fail("nameRequired");

  await new AdminUserRepo().updateProfile(input.userId, {
    name,
    now: Date.now(),
  });
  return ok(null);
}

/**
 * Change your own password.
 *
 * The current password is required even though the session already proves
 * identity: it stops a borrowed or hijacked session from locking the real owner
 * out of their own account.
 */
export async function changeOwnPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<Result<null, ProfileErrorReason>> {
  if (input.newPassword !== input.confirmPassword) return fail("mismatch");

  const weak = validatePasswordStrength(input.newPassword);
  if (weak) return fail("tooShort");

  if (input.newPassword === input.currentPassword) return fail("sameAsOld");

  const repo = new AdminUserRepo();
  const user = await repo.findByIdWithHash(input.userId);
  if (!user) return fail("notFound");

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    return fail("wrongPassword");
  }

  await repo.updatePassword(
    user.id,
    await hashPassword(input.newPassword),
    Date.now(),
  );
  return ok(null);
}
