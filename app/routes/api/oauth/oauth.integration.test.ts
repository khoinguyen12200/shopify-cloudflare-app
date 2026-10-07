import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { RouterContextProvider, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { action as registerAction } from "./register";
import { action as tokenAction } from "./token";
import { action as revokeAction } from "./revoke";
import { loader as resourceLoader } from "~/routes/.well-known/oauth-protected-resource";
import { loader as authServerLoader } from "~/routes/.well-known/oauth-authorization-server";
import { createCodeChallenge } from "~/domain/mcp/pkce";
import { issueAuthorizationCode } from "~/services/mcp/oauth.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { hashPassword } from "~/lib/password";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const asActionArgs = (request: Request): ActionFunctionArgs => ({
  request,
  params: {},
  url: new URL(request.url),
  pattern: new URL(request.url).pathname,
  context: new RouterContextProvider(),
});
const asLoaderArgs = (request: Request): LoaderFunctionArgs => ({
  request,
  params: {},
  url: new URL(request.url),
  pattern: new URL(request.url).pathname,
  context: new RouterContextProvider(),
});

describe("Zero-Touch OAuth 2.0 Integration", () => {
  it("serves RFC 9728 and RFC 8414 metadata", async () => {
    await inRequest(async () => {
      // 1. Protected resource metadata
      const resReq = new Request("http://localhost/.well-known/oauth-protected-resource");
      const resResp = await resourceLoader(asLoaderArgs(resReq));
      expect(resResp.status).toBe(200);
      const resJson = (await resResp.json()) as {
        resource?: string;
        authorization_servers?: string[];
      };
      expect(resJson.resource).toBeDefined();
      expect(resJson.authorization_servers).toBeDefined();

      // 2. Authorization server metadata
      const authReq = new Request("http://localhost/.well-known/oauth-authorization-server");
      const authResp = await authServerLoader(asLoaderArgs(authReq));
      expect(authResp.status).toBe(200);
      const authJson = (await authResp.json()) as {
        issuer?: string;
        authorization_endpoint?: string;
        token_endpoint?: string;
        registration_endpoint?: string;
        code_challenge_methods_supported?: string[];
      };
      expect(authJson.issuer).toBeDefined();
      expect(authJson.authorization_endpoint).toContain("/api/oauth/authorize");
      expect(authJson.token_endpoint).toContain("/api/oauth/token");
      expect(authJson.registration_endpoint).toContain("/api/oauth/register");
      expect(authJson.code_challenge_methods_supported).toContain("S256");
    });
  });

  it("completes full dynamic registration, authorization code exchange, refresh, and revocation", async () => {
    await inRequest(async () => {
      // 1. Dynamic Client Registration (RFC 7591)
      const regReq = new Request("http://localhost/api/oauth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: "Cursor AI Agent",
          redirect_uris: ["https://cursor.com/oauth/callback"],
        }),
      });

      const regResp = await registerAction(asActionArgs(regReq));
      expect(regResp.status).toBe(201);
      const regData = (await regResp.json()) as {
        client_id: string;
        client_name: string;
      };
      expect(regData.client_id).toMatch(/^mcp_cid_/);
      expect(regData.client_name).toBe("Cursor AI Agent");

      const clientId = regData.client_id;
      const redirectUri = "https://cursor.com/oauth/callback";

      // 2. Setup admin user
      const adminRepo = new AdminUserRepo();
      const pwHash = await hashPassword("Pass12345678!");
      const admin = await adminRepo.create({
        id: "admin-oauth-test",
        email: "staff@example.com",
        name: "Test Staff",
        passwordHash: pwHash,
        role: "admin",
        now: Date.now(),
      });

      // 3. Issue code with PKCE
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = await createCodeChallenge(verifier);

      const rawCode = await issueAuthorizationCode({
        clientId,
        adminUserId: admin.id,
        redirectUri,
        scope: "mcp:read mcp:tickets:write",
        codeChallenge: challenge,
        codeChallengeMethod: "S256",
      });

      expect(rawCode).toMatch(/^mcp_code_/);

      // 4. Exchange code for access & refresh token (RFC 7636)
      const tokenReq = new Request("http://localhost/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientId,
          code: rawCode,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        }),
      });

      const tokenResp = await tokenAction(asActionArgs(tokenReq));
      expect(tokenResp.status).toBe(200);
      const tokenData = (await tokenResp.json()) as {
        access_token: string;
        refresh_token: string;
        token_type: string;
      };
      expect(tokenData.access_token).toMatch(/^sc_tok_/);
      expect(tokenData.refresh_token).toMatch(/^sc_ref_/);
      expect(tokenData.token_type).toBe("Bearer");

      // 5. Exchange refresh token
      const refreshReq = new Request("http://localhost/api/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "refresh_token",
          client_id: clientId,
          refresh_token: tokenData.refresh_token,
        }),
      });

      const refreshResp = await tokenAction(asActionArgs(refreshReq));
      expect(refreshResp.status).toBe(200);
      const refreshData = (await refreshResp.json()) as {
        access_token: string;
        refresh_token: string;
      };
      expect(refreshData.access_token).toMatch(/^sc_tok_/);
      expect(refreshData.refresh_token).toBe(tokenData.refresh_token);

      // 6. Revoke access token (RFC 7009)
      const revokeReq = new Request("http://localhost/api/oauth/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: refreshData.access_token,
        }),
      });

      const revokeResp = await revokeAction(asActionArgs(revokeReq));
      expect(revokeResp.status).toBe(200);
    });
  });
});
