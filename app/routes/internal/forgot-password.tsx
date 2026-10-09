import { useActionData, useNavigation } from "react-router";
import type {
  ActionFunctionArgs,
  LinksFunction,
  MetaFunction,
} from "react-router";
import { Text } from "ngk-dashboard";
import { requestPasswordReset } from "~/services/password-reset.server";
import { isProductionLike } from "~/lib/deployment";
import { getEnv } from "~/request-context.server";
import { adminUsers, appRuntime, passwordResetNotifier, passwordResetTokens } from "~/wiring.server";
import { authLimiters } from "~/wiring.server";
import { handleForgotPasswordAction } from "./forgot-password.server";
import { INTERNAL_FONT_LINKS } from "~/internal/components";
import { AuthShell, ErrorAlert } from "./auth-shell";
import {
  BackToSignIn,
  ForgotPasswordForm,
  ForgotPasswordSent,
} from "./forgot-password-parts";
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

const FORGOT_PASSWORD_ERRORS = {
  emailRequired: "Enter your email address.",
  rateLimited: "Too many reset attempts. Try again later.",
} as const;

export const links: LinksFunction = () => [
  ...INTERNAL_FONT_LINKS,
  { rel: "stylesheet", href: internalStyles },
];

export const meta: MetaFunction = () => [
  { title: "Reset your password" },
  { name: "robots", content: "noindex, nofollow" },
];

export const action = async ({ request }: ActionFunctionArgs) => handleForgotPasswordAction(request, {
  limiter: authLimiters().passwordReset,
  productionLike: isProductionLike(getEnv().SHOPIFY_APP_URL ?? ""),
  requestReset: (email, origin) => requestPasswordReset({ email, origin }, {
    users: adminUsers(),
    tokens: passwordResetTokens(),
    notifier: passwordResetNotifier(),
    runtime: appRuntime(),
  }),
});

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const submitting = navigation.state !== "idle";
  const sent = actionData && "sent" in actionData;
  const error = actionData && "error" in actionData ? actionData.error : undefined;

  return (
    <AuthShell
      title="Reset your password"
      subtitle={
        <Text as="p" className="mt-1 text-sm text-muted-foreground">
          Enter your email address and we will send you a link to choose a
          new password.
        </Text>
      }
    >
      {error && <ErrorAlert message={FORGOT_PASSWORD_ERRORS[error]} />}
      {sent ? (
        <ForgotPasswordSent devToken={actionData.devToken} />
      ) : (
        <ForgotPasswordForm submitting={submitting} />
      )}
      <BackToSignIn />
    </AuthShell>
  );
}
