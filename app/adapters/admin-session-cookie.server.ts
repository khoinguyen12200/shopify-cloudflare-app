import { createCookieSessionStorage } from "react-router";

/**
 * The signed cookie that carries the internal console's session.
 *
 * Built per request from the `env` it is handed, not at module load: workerd has
 * no `process.env`, so the signing secret only exists on the `env` binding once
 * a request is in flight. Bound in `app/wiring.server.ts`.
 */
export function createAdminSessionCookieStorage(env: Pick<Env, "INTERNAL_SESSION_SECRET" | "SHOPIFY_APP_URL">) {
  const secret = env.INTERNAL_SESSION_SECRET;

  // Refuse to run with no secret rather than silently signing with a constant —
  // an unsigned-in-practice session cookie is forgeable, and a default value
  // that ships to production is worse than a crash on boot.
  if (!secret) {
    throw new Error(
      "INTERNAL_SESSION_SECRET is not set. Add it to .dev.vars locally, and " +
        "`wrangler secret put INTERNAL_SESSION_SECRET --env production`.",
    );
  }

  return createCookieSessionStorage({
    cookie: {
      name: "__internal_session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [secret],
      // Derived from the app URL, NOT process.env.NODE_ENV — that is undefined
      // on workerd, so the cookie would never be Secure in production.
      secure: (env.SHOPIFY_APP_URL ?? "").startsWith("https://"),
      maxAge: 60 * 60 * 24 * 7,
    },
  });
}
