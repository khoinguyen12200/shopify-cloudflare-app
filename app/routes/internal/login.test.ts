import { describe, expect, it } from "vitest";
import { handleLoginAction } from "./login.server";
import type { AuthAttemptLimiter } from "~/ports/auth-rate-limit";

type ActionResponse = { status: number };

async function submit(ip: string, limiter: AuthAttemptLimiter, productionLike = false): Promise<ActionResponse> {
  const form = new FormData();
  form.set("email", "nobody@example.org");
  form.set("password", "not-a-real-password");
  const request = new Request("https://example.test/internal/login", {
    method: "POST",
    body: form,
    headers: { "CF-Connecting-IP": ip },
  });
  const result = await handleLoginAction(request, {
    limiter,
    productionLike,
    verifyCredentials: async () => ({ ok: false, reason: "invalidCredentials" }),
    createSession: async () => new Response(null, { status: 302 }),
  });
  if (result instanceof Response) return { status: result.status };
  if (result && typeof result === "object" && "status" in result) return { status: Number(result.status) };
  if (result && typeof result === "object" && "init" in result) {
    const init = result.init;
    if (init && typeof init === "object" && "status" in init) return { status: Number(init.status) };
  }
  throw new Error(`Expected the action response: ${JSON.stringify(result)}`);
}

describe("internal login rate limiting", () => {
  it("rejects the sixth attempt from one client before credential verification", async () => {
    const ip = "203.0.113.91";
    let attempts = 0;
    const limiter: AuthAttemptLimiter = { check: async () => {
      attempts += 1;
      return attempts > 5 ? "limited" : "allowed";
    } };
    const statuses: ActionResponse[] = [];
    for (let index = 0; index < 6; index += 1) statuses.push(await submit(ip, limiter));

    expect(statuses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 429]);
    expect(attempts).toBe(6);
  });

  it("returns 503 in production-like configuration when the limiter is unavailable", async () => {
    const limiter: AuthAttemptLimiter = { check: async () => "unavailable" };
    const response = await submit("203.0.113.92", limiter, true);

    expect(response.status).toBe(503);
  });

  it("keeps local development usable when the limiter is unavailable", async () => {
    const limiter: AuthAttemptLimiter = { check: async () => "unavailable" };
    const response = await submit("203.0.113.93", limiter);

    expect(response.status).toBe(401);
  });
});
