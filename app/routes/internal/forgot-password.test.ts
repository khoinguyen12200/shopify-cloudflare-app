import { describe, expect, it } from "vitest";
import { handleForgotPasswordAction } from "./forgot-password";
import type { AuthAttemptLimiter } from "~/ports/auth-rate-limit";

const request = () => new Request("https://example.test/internal/forgot-password", {
  method: "POST",
  body: new URLSearchParams({ email: "admin@store.example" }),
});

describe("internal password reset rate limiting", () => {
  it("rejects the fourth attempt before issuing reset work", async () => {
    let attempts = 0;
    let issued = 0;
    const limiter: AuthAttemptLimiter = { check: async () => {
      attempts += 1;
      return attempts > 3 ? "limited" : "allowed";
    } };
    const run = () => handleForgotPasswordAction(request(), {
      limiter,
      productionLike: false,
      requestReset: async () => {
        issued += 1;
        return { requested: true, emailSent: false };
      },
    });

    const responses = [await run(), await run(), await run(), await run()];

    const statuses = responses.map((response) => {
      if (response && typeof response === "object" && "init" in response && response.init && typeof response.init === "object" && "status" in response.init) {
        return Number(response.init.status);
      }
      return 200;
    });
    expect(statuses).toEqual([200, 200, 200, 429]);
    expect(issued).toBe(3);
  });
});
