import { Form } from "react-router";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  Input,
  Label,
  PasswordInput,
  Text,
} from "ngk-dashboard";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";

export function ProfileAlerts({
  errorMessage,
  successMessage,
}: {
  errorMessage: string | undefined;
  successMessage: string | undefined;
}) {
  return (
    <>
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
    </>
  );
}

export function DetailsCard({
  user,
  busy,
}: {
  user: { name: string; email: string };
  busy: boolean;
}) {
  return (
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
  );
}

function NewPasswordFields() {
  return (
    <>
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
    </>
  );
}

export function ChangePasswordCard({ busy }: { busy: boolean }) {
  return (
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

          <NewPasswordFields />

          <div>
            <Button type="submit" disabled={busy}>
              Change password
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
