import { Form } from "react-router";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  PasswordInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from "ngk-dashboard";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";

function PasswordField() {
  return (
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
  );
}

function RoleField() {
  return (
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
  );
}

export function AddAdminCard({ busy, loading }: { busy: boolean; loading: boolean }) {
  return (
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

          <PasswordField />
          <RoleField />

          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} loading={loading}>
              Add admin
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
