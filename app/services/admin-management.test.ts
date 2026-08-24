import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import {
  createAdmin,
  removeAdmin,
  setAdminRole,
  setAdminStatus,
  changeOwnPassword,
  updateOwnProfile,
} from "./admin-management.server";
import { verifyPassword } from "~/lib/password";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

const GOOD_PASSWORD = "a-long-enough-password";

/** Create an owner directly, bypassing the use case, as a fixture. */
async function seedOwner(email = "owner@example.com") {
  const result = await createAdmin({
    name: "Owner",
    email,
    password: GOOD_PASSWORD,
    role: "owner",
  });
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
      });
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
      });
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
      }),
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
      });
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
      });
    });
    expect(result).toMatchObject({ ok: false, reason: "emailTaken" });
  });

  it("rejects a blank name, a bad email, and a short password", async () => {
    const results = await inRequest(async () => [
      await createAdmin({ name: "  ", email: "a@b.co", password: GOOD_PASSWORD, role: "admin" }),
      await createAdmin({ name: "N", email: "not-an-email", password: GOOD_PASSWORD, role: "admin" }),
      await createAdmin({ name: "N", email: "a@b.co", password: "short", role: "admin" }),
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
      });
      return setAdminStatus({
        actorId: "someone-else",
        targetId: owner.id,
        status: "disabled",
      });
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
      });
    });
    expect(result).toMatchObject({ ok: false, reason: "lastOwner" });
  });

  it("refuses to delete the LAST active owner", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      return removeAdmin({ actorId: "someone-else", targetId: owner.id });
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
      });
      return removeAdmin({ actorId: "someone-else", targetId: first.id });
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
      });
      if (!spare.ok) throw new Error("fixture");
      await new AdminUserRepo().setStatus(spare.value.id, "disabled", Date.now());

      return removeAdmin({ actorId: "someone-else", targetId: active.id });
    });
    expect(result).toMatchObject({ ok: false, reason: "lastOwner" });
  });

  it("refuses every self-targeting action", async () => {
    const results = await inRequest(async () => {
      const owner = await seedOwner();
      return [
        await setAdminStatus({ actorId: owner.id, targetId: owner.id, status: "disabled" }),
        await setAdminRole({ actorId: owner.id, targetId: owner.id, role: "admin" }),
        await removeAdmin({ actorId: owner.id, targetId: owner.id }),
      ];
    });
    for (const r of results) expect(r).toMatchObject({ ok: false, reason: "notYourself" });
  });

  it("reports notFound for an id that does not exist", async () => {
    const result = await inRequest(() =>
      removeAdmin({ actorId: "actor", targetId: "no-such-id" }),
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
      });
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
      });
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
        }),
        await changeOwnPassword({
          userId: owner.id,
          currentPassword: GOOD_PASSWORD,
          newPassword: "short",
          confirmPassword: "short",
        }),
        await changeOwnPassword({
          userId: owner.id,
          currentPassword: GOOD_PASSWORD,
          newPassword: GOOD_PASSWORD,
          confirmPassword: GOOD_PASSWORD,
        }),
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
  it("saves a trimmed name", async () => {
    const after = await inRequest(async () => {
      const owner = await seedOwner();
      await updateOwnProfile({ userId: owner.id, name: "  Renamed  " });
      return new AdminUserRepo().findById(owner.id);
    });
    expect(after?.name).toBe("Renamed");
  });

  it("refuses a blank name", async () => {
    const result = await inRequest(async () => {
      const owner = await seedOwner();
      return updateOwnProfile({ userId: owner.id, name: "   " });
    });
    expect(result).toMatchObject({ ok: false, reason: "nameRequired" });
  });
});
