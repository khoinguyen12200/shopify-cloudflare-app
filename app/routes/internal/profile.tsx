import { data, Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Alert,
  AlertDescription,
  BlockStack,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  Page,
  PasswordInput,
  Text,
} from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import {
  changeOwnPassword,
  updateOwnProfile,
} from "~/services/admin-management.server";
import type { ProfileErrorReason } from "~/services/admin-management.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import { adminUsers } from "~/wiring.server";

const LOCALE: Locale = "en";

const PROFILE_ERRORS: Record<ProfileErrorReason, string> = {
  nameRequired: "A name is required.",
  wrongPassword: "Your current password is not correct.",
  mismatch: "The new passwords do not match.",
  tooShort: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  sameAsOld: "The new password must be different from the current one.",
  notFound: "That account no longer exists.",
};

const PROFILE_SUCCESS: Record<SuccessKey, string> = {
  detailsSaved: "Your details were saved.",
  passwordChanged: "Your password was changed.",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const users = adminUsers();
  return { user: await requireAdminUser(request, { users }) };
};

type SuccessKey = "detailsSaved" | "passwordChanged";

export const action = async ({ request }: ActionFunctionArgs) => {
  const users = adminUsers();
  const user = await requireAdminUser(request, { users });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "details") {
    const detailsSaved: SuccessKey = "detailsSaved";
    const result = await updateOwnProfile({
      userId: user.id,
      name: String(form.get("name") ?? ""),
    }, { users });
    return result.ok
      ? data({ success: detailsSaved })
      : data({ error: result.reason }, { status: 400 });
  }

  if (intent === "password") {
    const passwordChanged: SuccessKey = "passwordChanged";
    const result = await changeOwnPassword({
      userId: user.id,
      currentPassword: String(form.get("currentPassword") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
      confirmPassword: String(form.get("confirmPassword") ?? ""),
    }, { users });
    return result.ok
      ? data({ success: passwordChanged })
      : data({ error: result.reason }, { status: 400 });
  }

  const notFound: ProfileErrorReason = "notFound";
  return data({ error: notFound }, { status: 400 });
};

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const busy = navigation.state !== "idle";

  return (
    <Page title="Profile" narrowWidth>
      <BlockStack gap={4}>
        {actionData && "error" in actionData && actionData.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {PROFILE_ERRORS[actionData.error]}
            </AlertDescription>
          </Alert>
        )}
        {actionData && "success" in actionData && actionData.success && (
          <Alert>
            <AlertDescription>
              {PROFILE_SUCCESS[actionData.success]}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <Text as="h2" className="font-semibold">
              Your details
            </Text>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex flex-col gap-4">
              <input type="hidden" name="intent" value="details" />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={user.name} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                {/* Read-only on purpose: changing your own sign-in address is an
                    account-takeover vector, so an owner does it for you. */}
                <Input id="email" value={user.email} readOnly disabled />
                <Text as="p" className="text-xs text-muted-foreground">
                  Ask an owner to change your email address.
                </Text>
              </div>

              <div>
                <Button type="submit" disabled={busy}>
                  Save
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Text as="h2" className="font-semibold">
              Change password
            </Text>
          </CardHeader>
          <CardContent>
            <Form method="post" className="flex flex-col gap-4">
              <input type="hidden" name="intent" value="password" />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="currentPassword">Current password</Label>
                {/* Required even though the session proves identity: it stops a
                    hijacked session from locking the real owner out. */}
                <PasswordInput
                  id="currentPassword"
                  name="currentPassword"
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
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

              <div>
                <Button type="submit" disabled={busy}>
                  Change password
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        {user.lastLoginAt && (
          <Text as="p" className="text-xs text-muted-foreground">
            {formatDateTime(LOCALE, user.lastLoginAt)}
          </Text>
        )}
      </BlockStack>
    </Page>
  );
}
