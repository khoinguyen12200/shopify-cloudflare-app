import {
  data,
  redirect,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Alert,
  AlertDescription,
  BlockStack,
  Button,
  Card,
  CardContent,
  Label,
  Page,
  PasswordInput,
  Text,
} from "ngk-dashboard";
import { requireOwner } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import {
  resetAdminPassword,
  type AdminErrorReason,
} from "~/services/admin-management.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { ADMIN_ERRORS } from "~/internal/admin-messages";

/**
 * An owner resets another admin's password.
 *
 * Its own route rather than a dialog on the table, for two reasons: the field
 * must exist without JavaScript (a dialog's contents live in a portal that only
 * renders once opened), and a form with validation needs somewhere to render its
 * errors.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const users = adminUsers();
  const actor = await requireOwner(request, { users });
  const targetId = params.adminId ?? "";

  // Resolve the target here so the page can name them, and so a bad id is a 404
  // rather than a form that fails on submit.
  const target = await users.findById(targetId);
  if (!target) throw new Response("Not found", { status: 404 });

  // Your own password goes through /internal/profile, which requires the current
  // one. Redirect rather than render a form that the service would refuse.
  if (target.id === actor.id) throw redirect("/internal/profile");

  return { target };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const users = adminUsers();
  const actor = await requireOwner(request, { users });
  const form = await request.formData();

  const newPassword = String(form.get("newPassword") ?? "");
  const confirmPassword = String(form.get("confirmPassword") ?? "");

  // Confirmation is a UI concern, checked here rather than in the service: the
  // service takes one password, and a mismatch is a typo, not a domain rule.
  if (newPassword !== confirmPassword) {
    return data({ error: "mismatch" as const }, { status: 400 });
  }

  const result = await resetAdminPassword({
    actorId: actor.id,
    targetId: params.adminId ?? "",
    newPassword,
  }, { users });

  if (!result.ok) {
    const reason: AdminErrorReason = result.reason;
    return data({ error: reason }, { status: 400 });
  }

  // Back to the table, which shows the success message.
  return redirect("/internal/admins?reset=1");
};

export default function ResetAdminPassword() {
  const { target } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const busy = navigation.state !== "idle";
  const error = actionData?.error;

  return (
    <Page
      title={`Reset the password for ${target.name}?`}
      narrowWidth
      backAction={{ label: "Admins", href: "/internal/admins" }}
    >
      <BlockStack gap={4}>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error === "mismatch"
                ? "The new passwords do not match."
                : ADMIN_ERRORS[error]}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <Form method="post" className="flex flex-col gap-4">
              <Text as="p" className="text-muted-foreground">
                Set a new password and give it to them directly. Their
                current password stops working immediately.
              </Text>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
                <Text as="p" className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters. Ask them to
                  change it after signing in.
                </Text>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>
                  Reset password
                </Button>
                <Button asChild variant="outline">
                  <Link to="/internal/admins">Cancel</Link>
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </BlockStack>
    </Page>
  );
}
