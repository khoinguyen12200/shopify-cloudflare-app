import { describe, expect, it, vi } from "vitest";
import { authClientKey } from "./auth-client-key";

describe("authClientKey", () => {
  it("uses Cloudflare's connecting-IP header as the limiter key", () => {
    const key = authClientKey(new Request("https://app.test/internal/login", {
      headers: { "CF-Connecting-IP": "203.0.113.42" },
    }));

    expect(key).toBe("203.0.113.42");
  });

  it("uses a deterministic local fallback when Cloudflare's header is absent", () => {
    const key = authClientKey(new Request("http://localhost:3000/internal/login"));

    expect(key).toBe("local");
  });

  it("does not log the raw client address", () => {
    const log = vi.spyOn(console, "log");

    authClientKey(new Request("https://app.test/internal/login", {
      headers: { "CF-Connecting-IP": "203.0.113.42" },
    }));

    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
