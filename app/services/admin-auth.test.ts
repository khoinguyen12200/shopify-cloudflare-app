import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import { createAdmin } from "./admin-management.server";
import {
  createAdminSession,
  destroyAdminSession,
  getAdminUser,
  requireAdminUser,
  requireOwner,
  safeRedirectPath,
  verifyAdminCredentials,
  HOME_PATH,
  LOGIN_PATH,
} from "./admin-auth.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const PASSWORD = "a-long-enough-password";

async function seed(
  email: string,
  role: "owner" | "admin" = "owner",
) {
  const created = await createAdmin({ name: "Test", email, password: PASSWORD, role });
  if (!created.ok) throw new Error(`fixture: ${created.reason}`);
  return created.value;
}

/** Pull the Set-Cookie a redirect response carries, to replay it as a request. */
function cookieFrom(response: Response): string {
  const header = response.headers.get("Set-Cookie");
  if (!header) throw new Error("expected a Set-Cookie header");
  return header.split(";")[0]!;
}

const request = (path = "/internal/dashboard", cookie?: string) =>
  new Request(`https://example.test${path}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });

describe("safeRedirectPath — the open-redirect guard", () => {
  it("allows a same-site path", () => {
    expect(safeRedirectPath("/internal/admins")).toBe("/internal/admins");
  });

  it("allows a path with a query string", () => {
    expect(safeRedirectPath("/internal/admins?page=2")).toBe(
      "/internal/admins?page=2",
    );
  });

  it("REJECTS a protocol-relative URL", () => {
    // `//evil.com` is a full URL to a browser. Without this, ?next= on the login
    // page is a phishing vector.
    expect(safeRedirectPath("//evil.com")).toBe(HOME_PATH);
  });

  it("REJECTS an absolute URL", () => {
    expect(safeRedirectPath("https://evil.com/steal")).toBe(HOME_PATH);
    expect(safeRedirectPath("http://evil.com")).toBe(HOME_PATH);
  });

  it("rejects anything that is not a string", () => {
    for (const bad of [undefined, null, 42, {}, []]) {
      expect(safeRedirectPath(bad)).toBe(HOME_PATH);
    }
  });

  it("rejects a relative path with no leading slash", () => {
    expect(safeRedirectPath("internal/admins")).toBe(HOME_PATH);
  });

  it("honours an explicit fallback", () => {
    expect(safeRedirectPath("//evil.com", LOGIN_PATH)).toBe(LOGIN_PATH);
  });
});

describe("verifyAdminCredentials", () => {
  it("accepts the right password", async () => {
    const result = await inRequest(async () => {
      await seed("ok@example.org");
      return verifyAdminCredentials("ok@example.org", PASSWORD);
    });
    expect(result.ok).toBe(true);
  });

  it("matches the email case-insensitively", async () => {
    const result = await inRequest(async () => {
      await seed("case@example.org");
      return verifyAdminCredentials("CASE@Example.ORG", PASSWORD);
    });
    expect(result.ok).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const result = await inRequest(async () => {
      await seed("wrong@example.org");
      return verifyAdminCredentials("wrong@example.org", "not-the-password");
    });
    expect(result).toMatchObject({ ok: false, reason: "invalidCredentials" });
  });

  it("gives an unknown email the SAME reason as a wrong password", async () => {
    // Anything else is a user-enumeration oracle: an attacker learns which
    // addresses have accounts.
    const [unknown, wrong] = await inRequest(async () => {
      await seed("real@example.org");
      return [
        await verifyAdminCredentials("nobody@example.org", PASSWORD),
        await verifyAdminCredentials("real@example.org", "nope"),
      ];
    });
    expect(unknown).toEqual(wrong);
  });

  it("reports a DISABLED account only after the password checks out", async () => {
    // Reporting `disabled` on a wrong password would reveal the account exists.
    const [wrongPassword, rightPassword] = await inRequest(async () => {
      const user = await seed("off@example.org");
      await new AdminUserRepo().setStatus(user.id, "disabled", Date.now());
      return [
        await verifyAdminCredentials("off@example.org", "not-the-password"),
        await verifyAdminCredentials("off@example.org", PASSWORD),
      ];
    });
    expect(wrongPassword).toMatchObject({ reason: "invalidCredentials" });
    expect(rightPassword).toMatchObject({ reason: "disabled" });
  });

  it("records the sign-in time on success", async () => {
    const after = await inRequest(async () => {
      const user = await seed("stamp@example.org");
      await verifyAdminCredentials("stamp@example.org", PASSWORD);
      return new AdminUserRepo().findById(user.id);
    });
    expect(after?.lastLoginAt).toBeTypeOf("number");
  });

  it("never returns the password hash", async () => {
    const result = await inRequest(async () => {
      await seed("safe@example.org");
      return verifyAdminCredentials("safe@example.org", PASSWORD);
    });
    expect(result.ok && "passwordHash" in result.user).toBe(false);
  });
});

describe("sessions round-trip", () => {
  it("creates a session that getAdminUser can read back", async () => {
    const user = await inRequest(async () => {
      const admin = await seed("session@example.org");
      const response = await createAdminSession(admin.id, HOME_PATH);
      return getAdminUser(request("/internal/dashboard", cookieFrom(response)));
    });
    expect(user?.email).toBe("session@example.org");
  });

  it("redirects to where it was told", async () => {
    const response = await inRequest(async () => {
      const admin = await seed("redir@example.org");
      return createAdminSession(admin.id, "/internal/admins");
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/internal/admins");
  });

  it("sets an httpOnly cookie", async () => {
    const header = await inRequest(async () => {
      const admin = await seed("httponly@example.org");
      const response = await createAdminSession(admin.id, HOME_PATH);
      return response.headers.get("Set-Cookie") ?? "";
    });
    // A session cookie readable from JavaScript is stealable by any injected
    // script.
    expect(header.toLowerCase()).toContain("httponly");
  });

  it("destroys the session and sends you to login", async () => {
    const after = await inRequest(async () => {
      const admin = await seed("bye@example.org");
      const created = await createAdminSession(admin.id, HOME_PATH);
      const destroyed = await destroyAdminSession(
        request("/internal/logout", cookieFrom(created)),
      );
      return {
        location: destroyed.headers.get("Location"),
        user: await getAdminUser(
          request("/internal/dashboard", cookieFrom(destroyed)),
        ),
      };
    });
    expect(after.location).toBe(LOGIN_PATH);
    expect(after.user).toBeUndefined();
  });

  it("returns undefined with no cookie at all", async () => {
    const user = await inRequest(() => getAdminUser(request()));
    expect(user).toBeUndefined();
  });

  it("returns undefined for a forged cookie", async () => {
    // The cookie is signed, so an invented value must not authenticate.
    const user = await inRequest(() =>
      getAdminUser(request("/internal/dashboard", "__internal_session=forged")),
    );
    expect(user).toBeUndefined();
  });

  it("revokes access IMMEDIATELY when the account is disabled", async () => {
    // Not at cookie expiry — a disabled admin must lose access on their next
    // request, with the same cookie they already hold.
    const user = await inRequest(async () => {
      const admin = await seed("revoke@example.org");
      const cookie = cookieFrom(await createAdminSession(admin.id, HOME_PATH));
      await new AdminUserRepo().setStatus(admin.id, "disabled", Date.now());
      return getAdminUser(request("/internal/dashboard", cookie));
    });
    expect(user).toBeUndefined();
  });

  it("stops authenticating a DELETED account", async () => {
    const user = await inRequest(async () => {
      const admin = await seed("deleted@example.org");
      const cookie = cookieFrom(await createAdminSession(admin.id, HOME_PATH));
      await new AdminUserRepo().remove(admin.id);
      return getAdminUser(request("/internal/dashboard", cookie));
    });
    expect(user).toBeUndefined();
  });
});

describe("requireAdminUser", () => {
  it("returns the user when signed in", async () => {
    const user = await inRequest(async () => {
      const admin = await seed("req@example.org");
      const cookie = cookieFrom(await createAdminSession(admin.id, HOME_PATH));
      return requireAdminUser(request("/internal/dashboard", cookie));
    });
    expect(user.email).toBe("req@example.org");
  });

  it("throws a redirect to login, carrying where you were going", async () => {
    const thrown = await inRequest(async () => {
      try {
        await requireAdminUser(request("/internal/admins?page=2"));
        return null;
      } catch (error) {
        return error;
      }
    });

    expect(thrown).toBeInstanceOf(Response);
    const location = (thrown as Response).headers.get("Location") ?? "";
    expect(location).toContain(LOGIN_PATH);
    // So login can send them back where they meant to go.
    expect(decodeURIComponent(location)).toContain("/internal/admins?page=2");
  });

  it("clears the stale cookie on the way out", async () => {
    const thrown = await inRequest(async () => {
      try {
        await requireAdminUser(
          request("/internal/dashboard", "__internal_session=forged"),
        );
        return null;
      } catch (error) {
        return error as Response;
      }
    });
    expect((thrown as Response).headers.get("Set-Cookie")).toBeTruthy();
  });
});

describe("requireOwner — the only thing gating staff management", () => {
  it("returns an owner", async () => {
    const user = await inRequest(async () => {
      const admin = await seed("owner@example.org", "owner");
      const cookie = cookieFrom(await createAdminSession(admin.id, HOME_PATH));
      return requireOwner(request("/internal/admins", cookie));
    });
    expect(user.role).toBe("owner");
  });

  it("THROWS 403 for a signed-in admin — it must not return", async () => {
    // If this ever returned, any admin could promote themselves to owner.
    const thrown = await inRequest(async () => {
      const owner = await seed("keeper@example.org", "owner");
      const admin = await createAdmin({
        name: "Plain",
        email: "plain@example.org",
        password: PASSWORD,
        role: "admin",
      });
      if (!admin.ok) throw new Error("fixture");
      void owner;
      const cookie = cookieFrom(await createAdminSession(admin.value.id, HOME_PATH));
      try {
        await requireOwner(request("/internal/admins", cookie));
        return null;
      } catch (error) {
        return error as Response;
      }
    });

    expect(thrown).toBeInstanceOf(Response);
    // 403, not a redirect: they ARE signed in, they simply may not do this.
    expect((thrown as Response).status).toBe(403);
  });

  it("redirects rather than 403s when nobody is signed in", async () => {
    const thrown = await inRequest(async () => {
      try {
        await requireOwner(request("/internal/admins"));
        return null;
      } catch (error) {
        return error as Response;
      }
    });
    expect((thrown as Response).status).toBe(302);
  });
});
