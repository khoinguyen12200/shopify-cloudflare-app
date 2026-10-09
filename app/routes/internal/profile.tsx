import { data, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Profile · Staff Console" },
];
import { BlockStack, Page, Text } from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import {
  changeOwnPassword,
  updateOwnProfile,
} from "~/services/admin-management.server";
import type { ProfileErrorReason } from "~/services/admin-management.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import { adminUsers, adminSessionUsers, appRuntime } from "~/wiring.server";
import {
  ChangePasswordCard,
  DetailsCard,
  ProfileAlerts,
} from "./profile-forms";

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
  return { user: await requireAdminUser(request, { users: adminSessionUsers() }) };
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
    }, { users, runtime: appRuntime() });
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
    }, { users, runtime: appRuntime() });
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
  const errorMessage =
    actionData && "error" in actionData && actionData.error
      ? PROFILE_ERRORS[actionData.error]
      : undefined;
  const successMessage =
    actionData && "success" in actionData && actionData.success
      ? PROFILE_SUCCESS[actionData.success]
      : undefined;

  return (
    <Page title="Profile" narrowWidth>
      <BlockStack gap={4}>
        <ProfileAlerts errorMessage={errorMessage} successMessage={successMessage} />
        <DetailsCard user={user} busy={busy} />
        <ChangePasswordCard busy={busy} />

        {user.lastLoginAt && (
          <Text as="p" className="text-xs text-muted-foreground">
            {formatDateTime(LOCALE, user.lastLoginAt, UTC)}
          </Text>
        )}
      </BlockStack>
    </Page>
  );
}
