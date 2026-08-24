import {
  data,
  redirect,
  Form,
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
import { Alert, AlertDescription, Button, Input, Label } from "ngk-dashboard";
import { useTranslation } from "react-i18next";
import {
  createAdminSession,
  getAdminUser,
  safeRedirectPath,
  verifyAdminCredentials,
  HOME_PATH,
} from "~/services/admin-auth.server";
import { getEnv } from "~/request-context.server";
import { INTERNAL_FONT_LINKS, THEME_INIT_SCRIPT } from "~/internal/components";
// Login sits OUTSIDE the /internal layout (see app/routes.ts), so it does not
// inherit that layout's links() and must load the console stylesheet itself —
// otherwise it renders completely unstyled.
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

export const handle = { i18n: ["common", "internal"] };

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
  if (await getAdminUser(request)) throw redirect(HOME_PATH);

  const url = new URL(request.url);
  return {
    next: safeRedirectPath(url.searchParams.get("next")),
    // Show the seeded credentials in local dev only — never in production.
    showDevHint: !(getEnv().SHOPIFY_APP_URL ?? "").startsWith("https://"),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeRedirectPath(form.get("next"));

  if (!email || !password) {
    return data({ error: "missingFields" as const }, { status: 400 });
  }

  const result = await verifyAdminCredentials(email, password);
  if (!result.ok) {
    // 401, and the same generic message for a wrong password as for an unknown
    // email — anything else tells an attacker which emails exist.
    return data({ error: result.reason }, { status: 401 });
  }

  return createAdminSession(result.user.id, next);
};

export default function InternalLogin() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { next, showDevHint } = useLoaderData<typeof loader>();
  const { t } = useTranslation("internal");

  const submitting = navigation.state !== "idle";
  const error = actionData?.error;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("login.heading")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("login.subheading")}
            </p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{t(`login.${error}`)}</AlertDescription>
            </Alert>
          )}

          <Form method="post" className="flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>

            <Button type="submit" disabled={submitting}>
              {submitting ? t("login.submitting") : t("login.submit")}
            </Button>
          </Form>

          {showDevHint && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              {t("login.devHint")}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
