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
import { adminUsers } from "~/wiring.server";
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
import type { SafeAdminUser } from "~/db/schema";
import { INTENTS, SUCCESS_KEY, readIntent, type Intent } from "./intents.server";
import { formatSuccessMessage } from "./success-message";

const LOCALE: Locale = "en";

/** id of the hidden removal form that the ConfirmDialog submits. */
const REMOVE_FORM_ID = "remove-admin";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only. requireOwner throws 403 for a signed-in non-owner, which the
  // layout's ErrorBoundary renders.
  const actor = await requireOwner(request, { users: adminUsers() });
  const url = new URL(request.url);
  return {
    actor,
    admins: await adminUsers().list(),
    // Set by reset.tsx's redirect after a password reset — that page has
    // nothing of its own to render success on, since it navigates away.
    resetSuccess: url.searchParams.get("reset") === "1",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireOwner(request, { users: adminUsers() });
  const form = await request.formData();
  const intent = readIntent(form);

  // Unknown intent: a bad request, not a crash.
  if (!intent) {
    const notFound: AdminErrorReason = "notFound";
    return data({ error: notFound }, { status: 400 });
  }

  const handler = INTENTS[intent];

  const result = await handler(form, actor.id);
  if (!result.ok) return data({ error: result.reason }, { status: 400 });

  return data({
    success: SUCCESS_KEY[intent],
    name: result.value?.name ?? "",
    role: result.value?.role ?? "",
  });
};

/** The role label, looked up by comparison rather than asserted with `as`. */
function roleLabel(role: string): string {
  return role === "owner" || role === "admin" ? ADMIN_ROLE_LABEL[role] : "";
}

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
          roleLabel(actionData.role),
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
