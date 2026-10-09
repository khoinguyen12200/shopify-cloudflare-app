import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { McpAuditLogRepo, McpOAuthRepo, McpTokenRepo } from "./mcp.server";
import { AdminUserRepo } from "./admin-users.server";
import { hashPassword } from "~/lib/password";
import { testRandomBytes } from "~/test/fake-runtime";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

describe("MCP Persistence Layer", () => {
  const adminRepo = new AdminUserRepo();
  const tokenRepo = new McpTokenRepo();
  const oauthRepo = new McpOAuthRepo();
  const auditRepo = new McpAuditLogRepo();

  async function createAdmin(email = "staff@example.com") {
    const passwordHash = await hashPassword("ValidPassword123!", testRandomBytes);
    return adminRepo.create({
      id: `admin-${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
      email,
      name: "Staff Member",
      passwordHash,
      role: "admin",
      now: Date.now(),
    });
  }

  it("creates, finds, and revokes Personal Access Tokens", async () => {
    await inRequest(async () => {
      const admin = await createAdmin("token-tester@example.com");
      const now = Date.now();

      const created = await tokenRepo.createToken({
        id: "pat-1",
        type: "pat",
        tokenHash: "hash-12345",
        tokenPrefix: "sc_pat_123",
        label: "Cursor IDE",
        scopes: ["mcp:read", "mcp:tickets:write"],
        adminUserId: admin.id,
        createdAt: now,
      });

      expect(created.id).toBe("pat-1");
      expect(created.label).toBe("Cursor IDE");
      expect(created.scopes).toEqual(["mcp:read", "mcp:tickets:write"]);

      const found = await tokenRepo.findByHash("hash-12345");
      expect(found).toBeDefined();
      expect(found?.id).toBe("pat-1");

      // List tokens for admin
      const list = await tokenRepo.listTokensForAdmin(admin.id);
      expect(list.length).toBe(1);
      expect(list[0]?.id).toBe("pat-1");

      // Revoke
      const revoked = await tokenRepo.revokeToken("pat-1", now + 1000);
      expect(revoked).toBe(true);

      const foundAfterRevoke = await tokenRepo.findByHash("hash-12345");
      expect(foundAfterRevoke?.revokedAt).toBe(now + 1000);

      // Second revoke is no-op
      expect(await tokenRepo.revokeToken("pat-1", now + 2000)).toBe(false);
    });
  });

  it("handles OAuth clients and temporary authorization codes", async () => {
    await inRequest(async () => {
      const admin = await createAdmin("oauth-tester@example.com");
      const now = Date.now();

      const client = await oauthRepo.createClient({
        id: "client-1",
        clientId: "mcp_cid_abc",
        clientName: "Gemini Spark",
        clientType: "public",
        registrationType: "dynamic",
        redirectUris: ["https://gemini.google.com/oauth/callback"],
        allowedScopes: ["mcp:read", "mcp:tickets:write"],
        createdAt: now,
      });

      expect(client.clientId).toBe("mcp_cid_abc");
      expect(client.redirectUris).toEqual(["https://gemini.google.com/oauth/callback"]);

      const foundClient = await oauthRepo.findClientByClientId("mcp_cid_abc");
      expect(foundClient?.clientName).toBe("Gemini Spark");

      // Auth code
      const authCode = await oauthRepo.createAuthCode({
        id: "code-1",
        codeHash: "codehash-xyz",
        clientId: client.clientId,
        adminUserId: admin.id,
        redirectUri: "https://gemini.google.com/oauth/callback",
        scope: "mcp:read",
        codeChallenge: "challenge-s256",
        codeChallengeMethod: "S256",
        expiresAt: now + 600_000,
        createdAt: now,
      });

      expect(authCode.codeHash).toBe("codehash-xyz");

      const foundCode = await oauthRepo.findAuthCodeByHash("codehash-xyz");
      expect(foundCode).toBeDefined();
      expect(foundCode?.usedAt).toBeNull();

      await oauthRepo.markAuthCodeUsed("code-1", now + 5000);
      const usedCode = await oauthRepo.findAuthCodeByHash("codehash-xyz");
      expect(usedCode?.usedAt).toBe(now + 5000);
    });
  });

  it("records and retrieves audit logs", async () => {
    await inRequest(async () => {
      const now = Date.now();
      await auditRepo.createLog({
        id: "audit-1",
        actorEmail: "staff@example.com",
        actorType: "staff_pat",
        toolName: "get_ticket",
        shop: "mystore.myshopify.com",
        isMutation: false,
        ok: true,
        latencyMs: 42,
        createdAt: now,
      });

      const recent = await auditRepo.listRecentLogs(10);
      expect(recent.length).toBe(1);
      expect(recent[0]?.toolName).toBe("get_ticket");
      expect(recent[0]?.shop).toBe("mystore.myshopify.com");
      expect(recent[0]?.latencyMs).toBe(42);
    });
  });
});
