import { Form, Link } from "react-router";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ngk-dashboard";
import { paths } from "~/urls";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import { ADMIN_ROLE_LABEL, ADMIN_STATUS_LABEL } from "~/internal/admin-messages";
import type { SafeAdminUser } from "~/db/schema";
import type { Intent } from "./intents.server";

const LOCALE: Locale = "en";

/** Whether the control for `intent` (optionally on row `id`) is the one submitting. */
export type IsPending = (intent: Intent, id?: string) => boolean;

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

interface RowActionsProps {
  readonly admin: SafeAdminUser;
  readonly busy: boolean;
  readonly isPending: IsPending;
  readonly onRemove: (admin: SafeAdminUser) => void;
}

function RowActions({ admin, busy, isPending, onRemove }: RowActionsProps) {
  const statusIntent: Intent = admin.status === "active" ? "disable" : "enable";
  const roleIntent: Intent = admin.role === "owner" ? "makeAdmin" : "makeOwner";
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <RowAction
        id={admin.id}
        intent={statusIntent}
        label={admin.status === "active" ? "Disable" : "Enable"}
        busy={busy}
        loading={isPending(statusIntent, admin.id)}
      />
      <RowAction
        id={admin.id}
        intent={roleIntent}
        label={admin.role === "owner" ? "Make admin" : "Make owner"}
        busy={busy}
        loading={isPending(roleIntent, admin.id)}
      />
      {/* Its own page, not a dialog: the field needs to
          exist without JavaScript, and a portal's
          contents only render once opened. */}
      <Button asChild size="sm" variant="outline">
        <Link to={paths.internal.resetAdminPassword(admin.id)} prefetch="intent">
          Reset password
        </Link>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        disabled={busy}
        onClick={() => onRemove(admin)}
      >
        Remove
      </Button>
    </div>
  );
}

function AdminRow({
  admin,
  isSelf,
  busy,
  isPending,
  onRemove,
}: RowActionsProps & { isSelf: boolean }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {admin.name}
        {isSelf && (
          <Badge variant="secondary" className="ml-2">
            You
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{admin.email}</TableCell>
      <TableCell>
        <Badge variant={admin.role === "owner" ? "default" : "secondary"}>
          {ADMIN_ROLE_LABEL[admin.role]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={admin.status === "active" ? "outline" : "destructive"}>
          {ADMIN_STATUS_LABEL[admin.status]}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {admin.lastLoginAt ? formatDateTime(LOCALE, admin.lastLoginAt, UTC) : "Never"}
      </TableCell>
      <TableCell className="text-right">
        {/* Your own row has no actions: the guards would refuse
            them anyway, so offering the buttons is a lie. */}
        {!isSelf && (
          <RowActions admin={admin} busy={busy} isPending={isPending} onRemove={onRemove} />
        )}
      </TableCell>
    </TableRow>
  );
}

export function AdminsTable({
  admins,
  actorId,
  busy,
  isPending,
  onRemove,
}: {
  admins: readonly SafeAdminUser[];
  actorId: string;
  busy: boolean;
  isPending: IsPending;
  onRemove: (admin: SafeAdminUser) => void;
}) {
  return (
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
            {admins.map((admin) => (
              <AdminRow
                key={admin.id}
                admin={admin}
                isSelf={admin.id === actorId}
                busy={busy}
                isPending={isPending}
                onRemove={onRemove}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
