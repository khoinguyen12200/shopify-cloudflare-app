import { Form, Link } from "react-router";
import { Alert, AlertDescription, Button, PasswordInput } from "ngk-dashboard";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";
import { Field } from "./auth-shell";

export function ResetDone() {
  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertDescription>
          Your password was changed. You can sign in now.
        </AlertDescription>
      </Alert>
      <Button asChild>
        <Link to="/internal/login">Sign in</Link>
      </Button>
    </div>
  );
}

export function RequestNewLink() {
  return (
    <Button asChild variant="outline" className="w-full">
      <Link to="/internal/forgot-password">Request a new link</Link>
    </Button>
  );
}

export function ResetForm({ submitting }: { readonly submitting: boolean }) {
  return (
    <Form method="post" className="flex flex-col gap-4">
      <Field id="newPassword" label="New password">
        <PasswordInput
          id="newPassword"
          name="newPassword"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          autoFocus
        />
      </Field>

      <Field id="confirmPassword" label="Confirm new password">
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </Field>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Set password"}
      </Button>
    </Form>
  );
}
