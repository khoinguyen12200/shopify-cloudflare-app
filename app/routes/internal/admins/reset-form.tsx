import { Form, Link } from "react-router";
import { Button, Card, CardContent, Label, PasswordInput, Text } from "ngk-dashboard";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";

function NewPasswordField() {
  return (
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
  );
}

function ConfirmPasswordField() {
  return (
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
  );
}

export function ResetPasswordCard({ busy }: { busy: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Form method="post" className="flex flex-col gap-4">
          <Text as="p" className="text-muted-foreground">
            Set a new password and give it to them directly. Their
            current password stops working immediately.
          </Text>

          <NewPasswordField />
          <ConfirmPasswordField />

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
  );
}
