import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import {
  createAdmin,
  removeAdmin,
  resetAdminPassword,
  setAdminRole,
  setAdminStatus,
  changeOwnPassword,
  updateOwnProfile,
} from "./admin-management.server";
import { verifyPassword } from "~/lib/password";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

const GOOD_PASSWORD = "a-long-enough-password";
const adminDeps = { users: new AdminUserRepo() };

/** Create an owner directly, bypassing the use case, as a fixture. */
async function seedOwner(email = "owner@example.com") {
  const result = await createAdmin({
    name: "Owner",
    email,
    password: GOOD_PASSWORD,
    role: "owner",
  }, adminDeps);
  if (!result.ok) throw new Error(`fixture failed: ${result.reason}`);
  return result.value;
}

describe("createAdmin", () => {
  it("creates an account that can be found by email, case-insensitively", async () => {
    const found = await inRequest(async () => {
      await createAdmin({
        name: "Ada",
        email: "Ada@Example.COM",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      return new AdminUserRepo().findByEmailWithHash("ada@example.com");
    });

    expect(found?.name).toBe("Ada");
    expect(found?.email).toBe("ada@example.com");
  });

  it("stores a hash, never the password", async () => {
    const found = await inRequest(async () => {
      await createAdmin({
        name: "Ada",
        email: "ada@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      return new AdminUserRepo().findByEmailWithHash("ada@example.com");
    });

    expect(found!.passwordHash).not.toContain(GOOD_PASSWORD);
    expect(found!.passwordHash.startsWith("pbkdf2$")).toBe(true);
    expect(await verifyPassword(GOOD_PASSWORD, found!.passwordHash)).toBe(true);
  });

  it("never returns the hash to the caller", async () => {
    const result = await inRequest(() =>
      createAdmin({
        name: "Ada",
        email: "ada@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps),
    );
    expect(result.ok && "passwordHash" in result.value).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    const result = await inRequest(async () => {
      await seedOwner("dupe@example.com");
      return createAdmin({
        name: "Second",
        email: "dupe@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "emailTaken" });
  });

  it("rejects a duplicate email differing only in case", async () => {
    const result = await inRequest(async () => {
      await seedOwner("case@example.com");
      return createAdmin({
        name: "Second",
        email: "CASE@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "emailTaken" });
  });

  it("rejects a blank name, a bad email, and a short password", async () => {
    const results = await inRequest(async () => [
      await createAdmin({ name: "  ", email: "a@b.co", password: GOOD_PASSWORD, role: "admin" }, adminDeps),
      await createAdmin({ name: "N", email: "not-an-email", password: GOOD_PASSWORD, role: "admin" }, adminDeps),
      await createAdmin({ name: "N", email: "a@b.co", password: "short", role: "admin" }, adminDeps),
    ]);
    expect(results.map((r) => (r.ok ? "ok" : r.reason))).toEqual([
      "nameRequired",
      "emailInvalid",
      "tooShort",
    ]);
  });
});

describe("lockout guards — the reason this service exists", () => {
  it("refuses to disable the LAST active owner", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      // A second admin exists, but is not an owner.
      await createAdmin({
        name: "Helper",
        email: "helper@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      return setAdminStatus({
        actorId: "someone-else",
        targetId: owner.id,
        status: "disabled",
      }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "lastOwner" });
  });

  it("refuses to demote the LAST active owner", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      return setAdminRole({
        actorId: "someone-else",
        targetId: owner.id,
        role: "admin",
      }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "lastOwner" });
  });

  it("refuses to delete the LAST active owner", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      return removeAdmin({ actorId: "someone-else", targetId: owner.id }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "lastOwner" });
  });

  it("ALLOWS removing an owner once another active owner exists", async () => {
    const result = await inRequest(async () => {
      const first = await seedOwner("first@example.com");
      await createAdmin({
        name: "Second owner",
        email: "second@example.com",
        password: GOOD_PASSWORD,
        role: "owner",
      }, adminDeps);
      return removeAdmin({ actorId: "someone-else", targetId: first.id }, adminDeps);
    });
    expect(result.ok).toBe(true);
  });

  it("does NOT count a DISABLED owner as a remaining owner", async () => {
    // The subtle case: two owners, but one is disabled, so the active one is
    // still the last one who can actually sign in.
    const result = await inRequest(async () => {
      const active = await seedOwner("active@example.com");
      const spare = await createAdmin({
        name: "Spare",
        email: "spare@example.com",
        password: GOOD_PASSWORD,
        role: "owner",
      }, adminDeps);
      if (!spare.ok) throw new Error("fixture");
      await new AdminUserRepo().setStatus(spare.value.id, "disabled", Date.now());

      return removeAdmin({ actorId: "someone-else", targetId: active.id }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "lastOwner" });
  });

  it("refuses every self-targeting action", async () => {
    const results = await inRequest(async () => {
      const owner = await seedOwner();
      return [
        await setAdminStatus({ actorId: owner.id, targetId: owner.id, status: "disabled" }, adminDeps),
        await setAdminRole({ actorId: owner.id, targetId: owner.id, role: "admin" }, adminDeps),
        await removeAdmin({ actorId: owner.id, targetId: owner.id }, adminDeps),
      ];
    });
    for (const r of results) expect(r).toMatchObject({ ok: false, reason: "notYourself" });
  });

  it("reports notFound for an id that does not exist", async () => {
    const result = await inRequest(() =>
      removeAdmin({ actorId: "actor", targetId: "no-such-id" }, adminDeps),
    );
    expect(result).toMatchObject({ ok: false, reason: "notFound" });
  });
});

describe("changeOwnPassword", () => {
  it("changes the password when the current one is right", async () => {
    const outcome = await inRequest(async () => {
      const owner = await seedOwner();
      const result = await changeOwnPassword({
        userId: owner.id,
        currentPassword: GOOD_PASSWORD,
        newPassword: "a-brand-new-password",
        confirmPassword: "a-brand-new-password",
      }, adminDeps);
      const after = await new AdminUserRepo().findByIdWithHash(owner.id);
      return { result, hash: after!.passwordHash };
    });

    expect(outcome.result.ok).toBe(true);
    expect(await verifyPassword("a-brand-new-password", outcome.hash)).toBe(true);
    expect(await verifyPassword(GOOD_PASSWORD, outcome.hash)).toBe(false);
  });

  it("refuses a wrong current password, and leaves the old one working", async () => {
    const outcome = await inRequest(async () => {
      const owner = await seedOwner();
      const result = await changeOwnPassword({
        userId: owner.id,
        currentPassword: "not-the-password",
        newPassword: "a-brand-new-password",
        confirmPassword: "a-brand-new-password",
      }, adminDeps);
      const after = await new AdminUserRepo().findByIdWithHash(owner.id);
      return { result, hash: after!.passwordHash };
    });

    expect(outcome.result).toMatchObject({ ok: false, reason: "wrongPassword" });
    expect(await verifyPassword(GOOD_PASSWORD, outcome.hash)).toBe(true);
  });

  it("refuses mismatched confirmation, a short password, and reuse", async () => {
    const results = await inRequest(async () => {
      const owner = await seedOwner();
      return [
        await changeOwnPassword({
          userId: owner.id,
          currentPassword: GOOD_PASSWORD,
          newPassword: "a-brand-new-password",
          confirmPassword: "a-different-password",
        }, adminDeps),
        await changeOwnPassword({
          userId: owner.id,
          currentPassword: GOOD_PASSWORD,
          newPassword: "short",
          confirmPassword: "short",
        }, adminDeps),
        await changeOwnPassword({
          userId: owner.id,
          currentPassword: GOOD_PASSWORD,
          newPassword: GOOD_PASSWORD,
          confirmPassword: GOOD_PASSWORD,
        }, adminDeps),
      ];
    });
    expect(results.map((r) => (r.ok ? "ok" : r.reason))).toEqual([
      "mismatch",
      "tooShort",
      "sameAsOld",
    ]);
  });
});

describe("updateOwnProfile", () => {
  it("uses injected user port without request context", async () => {
    let saved: { id: string; name: string; now: number } | undefined;
    const result = await updateOwnProfile(
      { userId: "user-1", name: "  Renamed  " },
      {
        users: {
          updateProfile: async (id, input) => { saved = { id, ...input }; },
        },
      },
    );

    expect(result).toEqual({ ok: true, value: null });
    expect(saved).toMatchObject({ id: "user-1", name: "Renamed" });
  });

  it("saves a trimmed name", async () => {
    const after = await inRequest(async () => {
      const owner = await seedOwner();
      await updateOwnProfile({ userId: owner.id, name: "  Renamed  " }, adminDeps);
      return new AdminUserRepo().findById(owner.id);
    });
    expect(after?.name).toBe("Renamed");
  });

  it("refuses a blank name", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      return updateOwnProfile({ userId: owner.id, name: "   " }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "nameRequired" });
  });
});

describe("resetAdminPassword — an owner helping someone who is locked out", () => {
  it("replaces the target's password", async () => {
    const outcome = await inRequest(async () => {
      const owner = await seedOwner("owner@example.com");
      const created = await createAdmin({
        name: "Forgetful",
        email: "forgetful@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      if (!created.ok) throw new Error("fixture");

      const result = await resetAdminPassword({
        actorId: owner.id,
        targetId: created.value.id,
        newPassword: "a-fresh-temporary-pass",
      }, adminDeps);
      const after = await new AdminUserRepo().findByIdWithHash(created.value.id);
      return { result, hash: after!.passwordHash };
    });

    expect(outcome.result.ok).toBe(true);
    expect(await verifyPassword("a-fresh-temporary-pass", outcome.hash)).toBe(true);
    // The old password must stop working immediately.
    expect(await verifyPassword(GOOD_PASSWORD, outcome.hash)).toBe(false);
  });

  it("does not require knowing the target's old password", async () => {
    // That is the whole point: the owner cannot know it.
    const result = await inRequest(async () => {
      const owner = await seedOwner("owner@example.com");
      const created = await createAdmin({
        name: "Locked out",
        email: "locked@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      if (!created.ok) throw new Error("fixture");
      return resetAdminPassword({
        actorId: owner.id,
        targetId: created.value.id,
        newPassword: "another-long-password",
      }, adminDeps);
    });
    expect(result.ok).toBe(true);
  });

  it("refuses to target YOUR OWN account", async () => {
    // Otherwise a borrowed session becomes a permanent takeover with no
    // knowledge of the old password. Use changeOwnPassword instead.
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      return resetAdminPassword({
        actorId: owner.id,
        targetId: owner.id,
        newPassword: "a-long-enough-new-one",
      }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "notYourself" });
  });

  it("enforces the same length policy as the UI", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner("owner@example.com");
      const created = await createAdmin({
        name: "Target",
        email: "target@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      if (!created.ok) throw new Error("fixture");
      return resetAdminPassword({
        actorId: owner.id,
        targetId: created.value.id,
        newPassword: "short",
      }, adminDeps);
    });
    expect(result).toMatchObject({ ok: false, reason: "tooShort" });
  });

  it("leaves the password untouched when the policy rejects it", async () => {
    const hash = await inRequest(async () => {
      const owner = await seedOwner("owner@example.com");
      const created = await createAdmin({
        name: "Target",
        email: "target@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      if (!created.ok) throw new Error("fixture");
      await resetAdminPassword({
        actorId: owner.id,
        targetId: created.value.id,
        newPassword: "short",
      }, adminDeps);
      const after = await new AdminUserRepo().findByIdWithHash(created.value.id);
      return after!.passwordHash;
    });
    expect(await verifyPassword(GOOD_PASSWORD, hash)).toBe(true);
  });

  it("reports notFound for an unknown target", async () => {
    const result = await inRequest(() =>
      resetAdminPassword({
        actorId: "actor",
        targetId: "no-such-id",
        newPassword: "a-long-enough-password-x",
      }, adminDeps),
    );
    expect(result).toMatchObject({ ok: false, reason: "notFound" });
  });

  it("does not change the target's role or status", async () => {
    const after = await inRequest(async () => {
      const owner = await seedOwner("owner@example.com");
      const created = await createAdmin({
        name: "Target",
        email: "target@example.com",
        password: GOOD_PASSWORD,
        role: "admin",
      }, adminDeps);
      if (!created.ok) throw new Error("fixture");
      await resetAdminPassword({
        actorId: owner.id,
        targetId: created.value.id,
        newPassword: "a-fresh-temporary-pass",
      }, adminDeps);
      return new AdminUserRepo().findById(created.value.id);
    });
    expect(after).toMatchObject({ role: "admin", status: "active" });
  });
});
