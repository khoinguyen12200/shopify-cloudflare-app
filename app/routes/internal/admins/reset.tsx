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
import { useTranslation } from "react-i18next";
import { requireOwner } from "~/services/admin-auth.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import {
  resetAdminPassword,
  type AdminErrorReason,
} from "~/services/admin-management.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";

export const handle = { i18n: ["common", "internal"] };

/**
 * An owner resets another admin's password.
 *
 * Its own route rather than a dialog on the table, for two reasons: the field
 * must exist without JavaScript (a dialog's contents live in a portal that only
 * renders once opened), and a form with validation needs somewhere to render its
 * errors.
 */
export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const actor = await requireOwner(request);
  const targetId = params.adminId ?? "";

  // Resolve the target here so the page can name them, and so a bad id is a 404
  // rather than a form that fails on submit.
  const target = await new AdminUserRepo().findById(targetId);
  if (!target) throw new Response("Not found", { status: 404 });

  // Your own password goes through /internal/profile, which requires the current
  // one. Redirect rather than render a form that the service would refuse.
  if (target.id === actor.id) throw redirect("/internal/profile");

  return { target };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const actor = await requireOwner(request);
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
  });

  if (!result.ok) {
    return data({ error: result.reason as AdminErrorReason }, { status: 400 });
  }

  // Back to the table, which shows the success message.
  return redirect("/internal/admins?reset=1");
};

export default function ResetAdminPassword() {
  const { target } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation("internal");

  const busy = navigation.state !== "idle";
  const error = actionData?.error;

  return (
    <Page
      title={t("admins.reset.title", { name: target.name })}
      narrowWidth
      backAction={{ label: t("admins.heading"), href: "/internal/admins" }}
    >
      <BlockStack gap={4}>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error === "mismatch"
                ? t("profile.errors.mismatch")
                : t(`admins.errors.${error}`, { min: MIN_PASSWORD_LENGTH })}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="pt-6">
            <Form method="post" className="flex flex-col gap-4">
              <Text as="p" className="text-muted-foreground">
                {t("admins.reset.desc")}
              </Text>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="newPassword">
                  {t("admins.reset.newPassword")}
                </Label>
                <PasswordInput
                  id="newPassword"
                  name="newPassword"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoFocus
                />
                <Text as="p" className="text-xs text-muted-foreground">
                  {t("admins.add.hint", { min: MIN_PASSWORD_LENGTH })}
                </Text>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="confirmPassword">
                  {t("profile.confirmPassword")}
                </Label>
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
                  {t("admins.reset.confirm")}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/internal/admins">{t("admins.reset.cancel")}</Link>
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
      </BlockStack>
    </Page>
  );
}
