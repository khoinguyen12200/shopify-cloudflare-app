import { data, Form, Link, useActionData, useNavigation } from "react-router";
import type {
  ActionFunctionArgs,
  LinksFunction,
  MetaFunction,
} from "react-router";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  Text,
} from "ngk-dashboard";
import { requestPasswordReset } from "~/services/password-reset.server";
import { isProductionLike } from "~/lib/deployment";
import { getEnv } from "~/request-context.server";
import { paths } from "~/urls";
import { INTERNAL_FONT_LINKS, THEME_INIT_SCRIPT } from "~/internal/components";
import internalStyles from "~/styles/internal/internal.tailwind.css?url";

const FORGOT_PASSWORD_ERRORS = {
  emailRequired: "Enter your email address.",
} as const;

export const links: LinksFunction = () => [
  ...INTERNAL_FONT_LINKS,
  { rel: "stylesheet", href: internalStyles },
];

export const meta: MetaFunction = () => [
  { title: "Reset your password" },
  { name: "robots", content: "noindex, nofollow" },
];

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();

  if (!email) {
    return data({ error: "emailRequired" as const }, { status: 400 });
  }

  const result = await requestPasswordReset({
    email,
    // Derived from the request, so the link always points back at whichever
    // deployment (or tunnel) the person is actually using.
    origin: new URL(request.url).origin,
  });

  // ALWAYS the same shape, whatever happened — see requestPasswordReset. Never
  // branch the response on whether the account exists.
  //
  // The one exception is a LOCAL development convenience: when email is not
  // configured and this is not a real deployment, show the link so the flow can
  // be walked through without a mail server. Both conditions are required —
  // surfacing it on a real deployment would let anyone who can POST this form
  // obtain a reset link for any account.
  const showLink = !result.emailSent && !isProductionLike(getEnv().SHOPIFY_APP_URL ?? "");
  return data({
    sent: true as const,
    devToken: showLink ? result.token : undefined,
  });
};

export default function ForgotPassword() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const submitting = navigation.state !== "idle";
  const sent = actionData && "sent" in actionData;
  const error = actionData && "error" in actionData ? actionData.error : undefined;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Reset your password
            </h1>
            <Text as="p" className="mt-1 text-sm text-muted-foreground">
              Enter your email address and we will send you a link to choose a
              new password.
            </Text>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>
                {FORGOT_PASSWORD_ERRORS[error]}
              </AlertDescription>
            </Alert>
          )}

          {sent ? (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertDescription>
                  If an account exists for that address, a reset link is on
                  its way. The link expires in one hour.
                </AlertDescription>
              </Alert>

              {/* Local development only: the service returns the token when
                  email is not configured AND the deployment is not production.
                  It is never returned from a real deployment. */}
              {actionData.devToken && (
                <Alert>
                  <AlertDescription className="break-all">
                    Email is not configured locally, so here is the link:{" "}
                    <Link
                      to={paths.internal.resetPassword(actionData.devToken)}
                      className="underline"
                    >
                      /internal/reset-password/{actionData.devToken}
                    </Link>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ) : (
            <Form method="post" className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
            </Form>
          )}

          <p className="mt-6 text-center text-sm">
            <Link to="/internal/login" className="text-muted-foreground underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
