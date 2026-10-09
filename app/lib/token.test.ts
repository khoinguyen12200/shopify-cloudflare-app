import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "./token";
import { sequentialRandomBytes } from "~/test/fake-runtime";

const randomBytes = sequentialRandomBytes();
const mint = () => generateToken(randomBytes);

describe("generateToken", () => {
  it("is URL-safe", () => {
    for (let i = 0; i < 50; i += 1) {
      // A '+', '/' or '=' would need escaping inside a URL path.
      expect(mint()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 200 }, mint));
    expect(seen.size).toBe(200);
  });

  it("is fully determined by the random bytes it is given", () => {
    expect(generateToken(sequentialRandomBytes(9))).toBe(generateToken(sequentialRandomBytes(9)));
    expect(generateToken(sequentialRandomBytes(9))).not.toBe(generateToken(sequentialRandomBytes(10)));
  });

  it("carries 256 bits of entropy", () => {
    // 32 bytes → 43 base64url characters with padding stripped.
    expect(mint()).toHaveLength(43);
  });
});

describe("hashToken", () => {
  it("is deterministic", async () => {
    const token = mint();
    expect(await hashToken(token)).toBe(await hashToken(token));
  });

  it("differs for different tokens", async () => {
    expect(await hashToken("a")).not.toBe(await hashToken("b"));
  });

  it("returns hex SHA-256", async () => {
    expect(await hashToken("x")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches the known SHA-256 of a fixed input", async () => {
    // Pins the algorithm and encoding, so a refactor cannot silently change
    // what is stored and invalidate every outstanding token.
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("does not contain the token", async () => {
    const token = mint();
    expect(await hashToken(token)).not.toContain(token);
  });
});
