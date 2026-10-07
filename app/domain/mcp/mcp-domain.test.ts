import { describe, expect, it } from "vitest";
import {
  hasRequiredScope,
  isMcpScope,
  parseScopes,
} from "./scopes";
import {
  generateAccessToken,
  generateAuthCode,
  generateClientId,
  generateClientSecret,
  generatePat,
  generateRefreshToken,
  isTokenExpired,
  isTokenRevoked,
  sha256,
  timingSafeEqualStr,
} from "./tokens";
import { computeS256CodeChallenge, verifyCodeChallenge } from "./pkce";

describe("MCP Scopes Domain", () => {
  it("validates recognized scopes", () => {
    expect(isMcpScope("mcp:read")).toBe(true);
    expect(isMcpScope("mcp:admin")).toBe(true);
    expect(isMcpScope("invalid:scope")).toBe(false);
  });

  it("parses and deduplicates scope string", () => {
    expect(parseScopes("mcp:read mcp:tickets:write mcp:read")).toEqual([
      "mcp:read",
      "mcp:tickets:write",
    ]);
    expect(parseScopes("")).toEqual(["mcp:read"]);
    expect(parseScopes(null)).toEqual(["mcp:read"]);
  });

  it("evaluates scope hierarchy correctly", () => {
    expect(hasRequiredScope(["mcp:admin"], "mcp:tickets:write")).toBe(true);
    expect(hasRequiredScope(["mcp:read"], "mcp:shops:read")).toBe(true);
    expect(hasRequiredScope(["mcp:read"], "mcp:tickets:write")).toBe(false);
    expect(hasRequiredScope(["mcp:tickets:write"], "mcp:tickets:write")).toBe(true);
  });
});

describe("MCP Tokens Domain", () => {
  it("hashes values deterministically", async () => {
    const hash1 = await sha256("test-token-value");
    const hash2 = await sha256("test-token-value");
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it("compares strings in constant time", () => {
    expect(timingSafeEqualStr("token123", "token123")).toBe(true);
    expect(timingSafeEqualStr("token123", "token456")).toBe(false);
    expect(timingSafeEqualStr("short", "longer")).toBe(false);
  });

  it("generates correctly prefixed PAT and OAuth tokens", async () => {
    const pat = await generatePat();
    expect(pat.raw.startsWith("sc_pat_")).toBe(true);
    expect(pat.prefix.startsWith("sc_pat_")).toBe(true);
    expect(pat.hash.length).toBe(64);

    const access = await generateAccessToken();
    expect(access.raw.startsWith("sc_tok_")).toBe(true);

    const refresh = await generateRefreshToken();
    expect(refresh.raw.startsWith("sc_ref_")).toBe(true);

    const clientId = generateClientId();
    expect(clientId.startsWith("mcp_cid_")).toBe(true);

    const secret = await generateClientSecret();
    expect(secret.raw.startsWith("mcp_sec_")).toBe(true);

    const authCode = await generateAuthCode();
    expect(authCode.raw.startsWith("mcp_code_")).toBe(true);
  });

  it("checks expiration and revocation", () => {
    expect(isTokenExpired(1000, 500)).toBe(false);
    expect(isTokenExpired(1000, 1000)).toBe(true);
    expect(isTokenExpired(1000, 1500)).toBe(true);
    expect(isTokenExpired(null, 999999)).toBe(false);

    expect(isTokenRevoked(null)).toBe(false);
    expect(isTokenRevoked(12345)).toBe(true);
  });
});

describe("MCP PKCE Domain", () => {
  it("verifies S256 code challenge correctly", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await computeS256CodeChallenge(verifier);

    expect(await verifyCodeChallenge({ codeVerifier: verifier, codeChallenge: challenge, method: "S256" })).toBe(true);
    expect(await verifyCodeChallenge({ codeVerifier: "wrong-verifier", codeChallenge: challenge, method: "S256" })).toBe(false);
  });

  it("verifies plain code challenge", async () => {
    expect(await verifyCodeChallenge({ codeVerifier: "plain-secret", codeChallenge: "plain-secret", method: "plain" })).toBe(true);
    expect(await verifyCodeChallenge({ codeVerifier: "plain-secret", codeChallenge: "other-secret", method: "plain" })).toBe(false);
  });
});
