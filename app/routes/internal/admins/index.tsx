import {
  data,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useState } from "react";
import {
  Alert,
  AlertDescription,
  Badge,
  BlockStack,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  Input,
  Label,
  Page,
  PasswordInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "ngk-dashboard";
import { useTranslation } from "react-i18next";
import { requireOwner } from "~/services/admin-auth.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import {
  createAdmin,
  removeAdmin,
  resetAdminPassword,
  setAdminRole,
  setAdminStatus,
} from "~/services/admin-management.server";
// Type-only: erased at build, so it does not pull the server module into the
// client bundle.
import type { AdminErrorReason } from "~/services/admin-management.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { useLocale } from "~/i18n/useLocale";
import { formatDateTime } from "~/i18n/format";
import type { AdminRole, SafeAdminUser } from "~/db/schema";

export const handle = { i18n: ["common", "internal"] };

/** id of the hidden removal form that the ConfirmDialog submits. */
const REMOVE_FORM_ID = "remove-admin";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only. requireOwner throws 403 for a signed-in non-owner, which the
  // layout's ErrorBoundary renders.
  const actor = await requireOwner(request);
  return { actor, admins: await new AdminUserRepo().list() };
};

/**
 * Command dispatch on `intent`, per @rules/design-patterns.md: the action is a
 * thin lookup, and each intent's logic lives in the service.
 */
const INTENTS = {
  async create(form: FormData) {
    return createAdmin({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      role: (form.get("role") === "owner" ? "owner" : "admin") as AdminRole,
    });
  },
  async disable(form: FormData, actorId: string) {
    return setAdminStatus({
      actorId,
      targetId: String(form.get("id") ?? ""),
      status: "disabled",
    });
  },
  async enable(form: FormData, actorId: string) {
    return setAdminStatus({
      actorId,
      targetId: String(form.get("id") ?? ""),
      status: "active",
    });
  },
  async makeOwner(form: FormData, actorId: string) {
    return setAdminRole({
      actorId,
      targetId: String(form.get("id") ?? ""),
      role: "owner",
    });
  },
  async makeAdmin(form: FormData, actorId: string) {
    return setAdminRole({
      actorId,
      targetId: String(form.get("id") ?? ""),
      role: "admin",
    });
  },
  async remove(form: FormData, actorId: string) {
    return removeAdmin({ actorId, targetId: String(form.get("id") ?? "") });
  },
  async resetPassword(form: FormData, actorId: string) {
    const result = await resetAdminPassword({
      actorId,
      targetId: String(form.get("id") ?? ""),
      newPassword: String(form.get("newPassword") ?? ""),
    });
    // Normalise to the same { name, role } shape the other intents return, so
    // the action stays a thin dispatch.
    return result.ok
      ? ({ ok: true, value: result.value.user } as const)
      : result;
  },
} as const;

type Intent = keyof typeof INTENTS;

type SuccessKey =
  | "created"
  | "disabled"
  | "enabled"
  | "removed"
  | "roleChanged"
  | "passwordReset";

const SUCCESS_KEY: Record<Intent, SuccessKey> = {
  create: "created",
  disable: "disabled",
  enable: "enabled",
  makeOwner: "roleChanged",
  makeAdmin: "roleChanged",
  remove: "removed",
  resetPassword: "passwordReset",
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireOwner(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "") as Intent;

  const handler = INTENTS[intent];
  // Unknown intent: a bad request, not a crash.
  if (!handler) {
    return data({ error: "notFound" as AdminErrorReason }, { status: 400 });
  }

  const result = await handler(form, actor.id);
  if (!result.ok) return data({ error: result.reason }, { status: 400 });

  return data({
    success: SUCCESS_KEY[intent],
    name: result.value?.name ?? "",
    role: result.value?.role ?? "",
  });
};

export default function Admins() {
  const { actor, admins } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation("internal");
  const locale = useLocale();

  const busy = navigation.state !== "idle";

  // One dialog for the whole table rather than one per row: only ever a single
  // pending confirmation, so a single piece of state describes it.
  const [confirming, setConfirming] = useState<SafeAdminUser | null>(null);

  return (
    <Page title={t("admins.heading")} subtitle={t("admins.subheading")}>
      <BlockStack gap={4}>
        {actionData && "error" in actionData && actionData.error && (
          <Alert variant="destructive">
            <AlertDescription>
              {t(`admins.errors.${actionData.error}`, {
                min: MIN_PASSWORD_LENGTH,
              })}
            </AlertDescription>
          </Alert>
        )}
        {actionData && "success" in actionData && actionData.success && (
          <Alert>
            <AlertDescription>
              {t(`admins.success.${actionData.success}`, {
                name: actionData.name,
                role: actionData.role
                  ? t(`admins.role.${actionData.role}`)
                  : "",
              })}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admins.table.name")}</TableHead>
                  <TableHead>{t("admins.table.email")}</TableHead>
                  <TableHead>{t("admins.table.role")}</TableHead>
                  <TableHead>{t("admins.table.status")}</TableHead>
                  <TableHead>{t("admins.table.lastLogin")}</TableHead>
                  <TableHead className="text-right">
                    {t("admins.table.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => {
                  const isSelf = admin.id === actor.id;
                  return (
                    <TableRow key={admin.id}>
                      <TableCell className="font-medium">
                        {admin.name}
                        {isSelf && (
                          <Badge variant="secondary" className="ml-2">
                            {t("admins.you")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.email}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={admin.role === "owner" ? "default" : "secondary"}
                        >
                          {t(`admins.role.${admin.role}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            admin.status === "active" ? "outline" : "destructive"
                          }
                        >
                          {t(`admins.status.${admin.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.lastLoginAt
                          ? formatDateTime(locale, admin.lastLoginAt)
                          : t("admins.table.never")}
                      </TableCell>
                      <TableCell className="text-right">
                        {/* Your own row has no actions: the guards would refuse
                            them anyway, so offering the buttons is a lie. */}
                        {!isSelf && (
                          <div className="flex flex-wrap justify-end gap-1">
                            <RowAction
                              id={admin.id}
                              intent={
                                admin.status === "active" ? "disable" : "enable"
                              }
                              label={t(
                                admin.status === "active"
                                  ? "admins.actions.disable"
                                  : "admins.actions.enable",
                              )}
                              busy={busy}
                            />
                            <RowAction
                              id={admin.id}
                              intent={
                                admin.role === "owner" ? "makeAdmin" : "makeOwner"
                              }
                              label={t(
                                admin.role === "owner"
                                  ? "admins.actions.makeAdmin"
                                  : "admins.actions.makeOwner",
                              )}
                              busy={busy}
                            />
                            {/* Its own page, not a dialog: the field needs to
                                exist without JavaScript, and a portal's
                                contents only render once opened. */}
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/internal/admins/${admin.id}/reset`}>
                                {t("admins.reset.action")}
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => setConfirming(admin)}
                            >
                              {t("admins.actions.remove")}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Text as="h2" className="font-semibold">
              {t("admins.add.heading")}
            </Text>
          </CardHeader>
          <CardContent>
            <Form method="post" className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="intent" value="create" />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-name">{t("admins.add.name")}</Label>
                <Input id="new-name" name="name" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-email">{t("admins.add.email")}</Label>
                <Input id="new-email" name="email" type="email" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">{t("admins.add.password")}</Label>
                <PasswordInput
                  id="new-password"
                  name="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <Text as="p" className="text-xs text-muted-foreground">
                  {t("admins.add.hint", { min: MIN_PASSWORD_LENGTH })}
                </Text>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-role">{t("admins.add.role")}</Label>
                <Select name="role" defaultValue="admin">
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("admins.role.admin")}</SelectItem>
                    <SelectItem value="owner">{t("admins.role.owner")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  {t("admins.add.submit")}
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>
        {/*
          The dialog's confirm button submits THIS form by id, so removal stays a
          normal POST to the action — no fetch, no client-side mutation path, and
          the same server guards apply. Closing on submit is a plain event
          handler rather than an effect watching the navigation state.
        */}
        <Form
          method="post"
          id={REMOVE_FORM_ID}
          className="hidden"
          onSubmit={() => setConfirming(null)}
        >
          <input type="hidden" name="intent" value="remove" />
          <input type="hidden" name="id" value={confirming?.id ?? ""} />
        </Form>

        <ConfirmDialog
          open={confirming !== null}
          onOpenChange={(open) => {
            if (!open) setConfirming(null);
          }}
          form={REMOVE_FORM_ID}
          destructive
          isLoading={busy}
          title={t("admins.remove.title", { name: confirming?.name ?? "" })}
          desc={t("admins.remove.desc")}
          confirmText={t("admins.remove.confirm")}
          cancelBtnText={t("admins.remove.cancel")}
        />
      </BlockStack>
    </Page>
  );
}

/** A non-destructive row action: one small form, one button. */
function RowAction({
  id,
  intent,
  label,
  busy,
}: {
  id: string;
  intent: Intent;
  label: string;
  busy: boolean;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={busy}>
        {label}
      </Button>
    </Form>
  );
}
