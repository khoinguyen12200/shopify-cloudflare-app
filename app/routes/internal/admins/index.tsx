import {
  data,
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useEffect, useState } from "react";
import { toast } from "ngk-dashboard";
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
import { paths } from "~/urls";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import { useActionToast } from "~/internal/use-action-toast";
import {
  ADMIN_ERRORS,
  ADMIN_ROLE_LABEL,
  ADMIN_STATUS_LABEL,
} from "~/internal/admin-messages";
import type { AdminRole, SafeAdminUser } from "~/db/schema";

const LOCALE: Locale = "en";

/** id of the hidden removal form that the ConfirmDialog submits. */
const REMOVE_FORM_ID = "remove-admin";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only. requireOwner throws 403 for a signed-in non-owner, which the
  // layout's ErrorBoundary renders.
  const actor = await requireOwner(request);
  const url = new URL(request.url);
  return {
    actor,
    admins: await new AdminUserRepo().list(),
    // Set by reset.tsx's redirect after a password reset — that page has
    // nothing of its own to render success on, since it navigates away.
    resetSuccess: url.searchParams.get("reset") === "1",
  };
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

function formatSuccessMessage(key: SuccessKey, name: string, role: string): string {
  switch (key) {
    case "created":
      return `${name} can now sign in.`;
    case "disabled":
      return `${name} can no longer sign in.`;
    case "enabled":
      return `${name} can sign in again.`;
    case "removed":
      return `${name} was removed.`;
    case "roleChanged":
      return `${name} is now ${role}.`;
    case "passwordReset":
      return `Password reset for ${name}. Give them the new password directly.`;
  }
}

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
  const { actor, admins, resetSuccess } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const busy = navigation.state !== "idle";
  // Which single control is the one actually submitting, so only ITS button
  // spins — not every button on the page.
  const pendingIntent = navigation.formData?.get("intent");
  const pendingId = navigation.formData?.get("id");
  const isPending = (intent: Intent, id?: string) =>
    busy && pendingIntent === intent && (id === undefined || pendingId === id);

  const errorMessage =
    actionData && "error" in actionData && actionData.error
      ? ADMIN_ERRORS[actionData.error]
      : undefined;
  const successMessage =
    actionData && "success" in actionData && actionData.success
      ? formatSuccessMessage(
          actionData.success,
          actionData.name,
          actionData.role ? ADMIN_ROLE_LABEL[actionData.role as AdminRole] : "",
        )
      : undefined;

  // A toast on top of the inline Alert below, which stays the no-JS-safe,
  // authoritative feedback.
  useActionToast(actionData, { success: successMessage, error: errorMessage });

  // reset.tsx redirects here after a password reset — a distinct arrival, not
  // a submission on THIS page, so it can't ride the actionData-keyed hook
  // above.
  useEffect(() => {
    if (resetSuccess) {
      toast.success("Password reset. Give them the new password directly.");
    }
  }, [resetSuccess]);

  // One dialog for the whole table rather than one per row: only ever a single
  // pending confirmation, so a single piece of state describes it.
  const [confirming, setConfirming] = useState<SafeAdminUser | null>(null);

  return (
    <Page title="Admins" subtitle="Who can sign in to this console" fullWidth>
      <BlockStack gap={4}>
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {successMessage && (
          <Alert>
            <AlertDescription>{successMessage}</AlertDescription>
          </Alert>
        )}
        {resetSuccess && (
          <Alert>
            <AlertDescription>
              Password reset. Give them the new password directly.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                            You
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
                          {ADMIN_ROLE_LABEL[admin.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            admin.status === "active" ? "outline" : "destructive"
                          }
                        >
                          {ADMIN_STATUS_LABEL[admin.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {admin.lastLoginAt
                          ? formatDateTime(LOCALE, admin.lastLoginAt)
                          : "Never"}
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
                              label={admin.status === "active" ? "Disable" : "Enable"}
                              busy={busy}
                              loading={isPending(
                                admin.status === "active" ? "disable" : "enable",
                                admin.id,
                              )}
                            />
                            <RowAction
                              id={admin.id}
                              intent={
                                admin.role === "owner" ? "makeAdmin" : "makeOwner"
                              }
                              label={
                                admin.role === "owner" ? "Make admin" : "Make owner"
                              }
                              busy={busy}
                              loading={isPending(
                                admin.role === "owner" ? "makeAdmin" : "makeOwner",
                                admin.id,
                              )}
                            />
                            {/* Its own page, not a dialog: the field needs to
                                exist without JavaScript, and a portal's
                                contents only render once opened. */}
                            <Button asChild size="sm" variant="outline">
                              <Link to={paths.internal.resetAdminPassword(admin.id)}>
                                Reset password
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              disabled={busy}
                              onClick={() => setConfirming(admin)}
                            >
                              Remove
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
              Add an admin
            </Text>
          </CardHeader>
          <CardContent>
            <Form method="post" className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="intent" value="create" />

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-name">Name</Label>
                <Input id="new-name" name="name" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-email">Email</Label>
                <Input id="new-email" name="email" type="email" required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">Temporary password</Label>
                <PasswordInput
                  id="new-password"
                  name="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                />
                <Text as="p" className="text-xs text-muted-foreground">
                  At least {MIN_PASSWORD_LENGTH} characters. Ask them to
                  change it after signing in.
                </Text>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-role">Role</Label>
                <Select name="role" defaultValue="admin">
                  <SelectTrigger id="new-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy} loading={isPending("create")}>
                  Add admin
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
          title={`Remove ${confirming?.name ?? ""}?`}
          desc="They will lose access to the console immediately. This cannot be undone."
          confirmText="Remove"
          cancelBtnText="Cancel"
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
  loading,
}: {
  id: string;
  intent: Intent;
  label: string;
  busy: boolean;
  loading: boolean;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={busy}
        loading={loading}
      >
        {label}
      </Button>
    </Form>
  );
}
