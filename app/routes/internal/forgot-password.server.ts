import { data } from "react-router";
import { authClientKey } from "~/lib/auth-client-key";
import type { AuthAttemptLimiter } from "~/ports/auth-rate-limit";
import type { RequestResetOutcome } from "~/services/password-reset.server";

type ForgotPasswordActionDeps = {
  limiter: AuthAttemptLimiter;
  productionLike: boolean;
  requestReset: (email: string, origin: string) => Promise<RequestResetOutcome>;
};

export async function handleForgotPasswordAction(request: Request, deps: ForgotPasswordActionDeps) {
  const limit = await deps.limiter.check(authClientKey(request));
  if (limit === "limited") return data({ error: "rateLimited" as const }, { status: 429 });
  if (limit === "unavailable" && deps.productionLike) {
    return new Response("Authentication rate limiting is unavailable", { status: 503 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  if (!email) return data({ error: "emailRequired" as const }, { status: 400 });

  const result = await deps.requestReset(email, new URL(request.url).origin);
  const showLink = !result.emailSent && !deps.productionLike;
  return data({ sent: true as const, devToken: showLink ? result.token : undefined });
}
