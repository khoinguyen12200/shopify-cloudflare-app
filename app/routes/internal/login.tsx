import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { createAdminSession, getAdminUser, safeRedirectPath, verifyAdminCredentials, HOME_PATH } from "~/services/admin-auth.server";
import { getEnv } from "~/request-context.server";
import { adminUsers, appRuntime, authLimiters } from "~/wiring.server";
import { isProductionLike } from "~/lib/deployment";
import { handleLoginAction } from "./login.server";
import { INTERNAL_FONT_LINKS } from "~/internal/components";
import { AuthShell, ErrorAlert } from "./auth-shell";
import { LoginFooter, LoginForm } from "./login-form";
// Login sits OUTSIDE the /internal layout (see app/routes.ts), so it does not
// inherit that layout's links() and must load the console stylesheet itself —
// otherwise it renders completely unstyled.
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

const LOGIN_ERRORS = {
  invalidCredentials: "That email and password do not match an account.",
  disabled: "This account has been disabled.",
  missingFields: "Email and password are both required.",
  rateLimited: "Too many sign-in attempts. Try again later.",
} as const;

export const links: LinksFunction = () => [
  ...INTERNAL_FONT_LINKS,
  { rel: "stylesheet", href: internalStyles },
];

export const meta: MetaFunction = () => [
  { title: "Sign in" },
  // Never let a staff console be indexed.
  { name: "robots", content: "noindex, nofollow" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Already signed in? Skip the form.
  if (await getAdminUser(request, { users: adminUsers() })) throw redirect(HOME_PATH);

  const url = new URL(request.url);
  return {
    next: safeRedirectPath(url.searchParams.get("next")),
    // Show the seeded credentials in local dev only — never in production.
    showDevHint: !(getEnv().SHOPIFY_APP_URL ?? "").startsWith("https://"),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const users = adminUsers();
  return handleLoginAction(request, {
    limiter: authLimiters().login,
    verifyCredentials: (email, password) => verifyAdminCredentials(email, password, { users, runtime: appRuntime() }),
    createSession: createAdminSession,
    productionLike: isProductionLike(getEnv().SHOPIFY_APP_URL ?? ""),
  });
};

export default function InternalLogin() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { next, showDevHint } = useLoaderData<typeof loader>();

  const submitting = navigation.state !== "idle";
  const error = actionData?.error;

  return (
    <AuthShell
      title="Sign in"
      subtitle={
        <p className="mt-1 text-sm text-muted-foreground">Internal console</p>
      }
    >
      {error && <ErrorAlert message={LOGIN_ERRORS[error]} />}
      <LoginForm next={next} submitting={submitting} />
      <LoginFooter showDevHint={showDevHint} />
    </AuthShell>
  );
}
