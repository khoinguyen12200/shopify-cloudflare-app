import { data, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import {
  Alert,
  AlertDescription,
  Button,
  Label,
  PasswordInput,
  Text,
} from "ngk-dashboard";
import { useTranslation } from "react-i18next";
import {
  checkResetToken,
  completePasswordReset,
  type ResetFailure,
} from "~/services/password-reset.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { INTERNAL_FONT_LINKS, THEME_INIT_SCRIPT } from "~/internal/components";
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

export const handle = { i18n: ["common", "internal"] };

export const links: LinksFunction = () => [
  ...INTERNAL_FONT_LINKS,
  { rel: "stylesheet", href: internalStyles },
];

export const meta: MetaFunction = () => [
  { title: "Choose a new password" },
  // Never index a page whose URL is a credential.
  { name: "robots", content: "noindex, nofollow" },
];

/**
 * Validate the token before rendering the form, so a dead link says so
 * immediately instead of after someone types a password twice.
 */
export const loader = async ({ params }: LoaderFunctionArgs) => {
  const token = params.token ?? "";
  const checked = await checkResetToken(token);
  return { valid: checked.ok, reason: checked.ok ? undefined : checked.reason };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const form = await request.formData();

  const result = await completePasswordReset({
    // Re-validated inside: the token can expire or be spent between the GET
    // that rendered this form and the POST.
    token: params.token ?? "",
    newPassword: String(form.get("newPassword") ?? ""),
    confirmPassword: String(form.get("confirmPassword") ?? ""),
  });

  if (!result.ok) {
    return data({ error: result.reason }, { status: 400 });
  }

  // Deliberately NOT signed in automatically: whoever clicked proved control of
  // the inbox, not of the password they just set. Make them use it.
  return data({ done: true as const });
};

export default function ResetPassword() {
  const { valid, reason } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation("internal");

  const submitting = navigation.state !== "idle";
  const done = actionData && "done" in actionData;
  const error: ResetFailure | undefined =
    actionData && "error" in actionData ? actionData.error : reason;

  // A dead token, or one that died between render and submit.
  const deadToken =
    error === "invalidToken" || error === "expiredToken" || error === "usedToken";

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("passwordReset.reset.heading")}
            </h1>
            {valid && !done && (
              <Text as="p" className="mt-1 text-sm text-muted-foreground">
                {t("passwordReset.reset.lead")}
              </Text>
            )}
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {t(`passwordReset.reset.errors.${error}`, {
                  min: MIN_PASSWORD_LENGTH,
                })}
              </AlertDescription>
            </Alert>
          )}

          {done ? (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertDescription>
                  {t("passwordReset.reset.done")}
                </AlertDescription>
              </Alert>
              <Button asChild>
                <Link to="/internal/login">{t("passwordReset.reset.signIn")}</Link>
              </Button>
            </div>
          ) : deadToken ? (
            <Button asChild variant="outline" className="w-full">
              <Link to="/internal/forgot-password">
                {t("passwordReset.reset.requestAnother")}
              </Link>
            </Button>
          ) : (
            <Form method="post" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">
                  {t("passwordReset.reset.newPassword")}
                </Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">
                  {t("passwordReset.reset.confirmPassword")}
                </Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>

              <Button type="submit" disabled={submitting}>
                {submitting
                  ? t("passwordReset.reset.submitting")
                  : t("passwordReset.reset.submit")}
              </Button>
            </Form>
          )}
        </div>
      </div>
    </>
  );
}
