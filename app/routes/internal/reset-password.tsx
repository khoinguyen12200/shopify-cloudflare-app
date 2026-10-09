import { data, useActionData, useLoaderData, useNavigation } from "react-router";
import type {
  ActionFunctionArgs,
  LinksFunction,
  LoaderFunctionArgs,
  MetaFunction,
} from "react-router";
import { Text } from "ngk-dashboard";
import {
  checkResetToken,
  completePasswordReset,
  type ResetFailure,
} from "~/services/password-reset.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { INTERNAL_FONT_LINKS } from "~/internal/components";
import { AuthShell, ErrorAlert } from "./auth-shell";
import { RequestNewLink, ResetDone, ResetForm } from "./reset-password-parts";
import internalStyles from "~/styles/internal/internal.tailwind.css?url";
import { adminUsers, appRuntime, passwordResetTokens } from "~/wiring.server";

const RESET_PASSWORD_ERRORS: Record<ResetFailure, string> = {
  invalidToken: "That reset link is not valid. Request a new one.",
  expiredToken: "That reset link has expired. Request a new one.",
  usedToken: "That reset link has already been used. Request a new one.",
  tooShort: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  mismatch: "The passwords do not match.",
};

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
  const checked = await checkResetToken(token, { tokens: passwordResetTokens(), runtime: appRuntime() });
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
  }, { users: adminUsers(), tokens: passwordResetTokens(), runtime: appRuntime() });

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

  const submitting = navigation.state !== "idle";
  const done = actionData && "done" in actionData;
  const error: ResetFailure | undefined =
    actionData && "error" in actionData ? actionData.error : reason;

  // A dead token, or one that died between render and submit.
  const deadToken =
    error === "invalidToken" || error === "expiredToken" || error === "usedToken";

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={
        valid && !done && (
          <Text as="p" className="mt-1 text-sm text-muted-foreground">
            Pick a password you have not used here before.
          </Text>
        )
      }
    >
      {error && <ErrorAlert message={RESET_PASSWORD_ERRORS[error]} />}
      {done ? <ResetDone /> : deadToken ? <RequestNewLink /> : <ResetForm submitting={submitting} />}
    </AuthShell>
  );
}
