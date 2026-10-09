import { Form, Link } from "react-router";
import { Button, Input } from "ngk-dashboard";
import { EmailField, Field } from "./auth-shell";

export function LoginForm({
  next,
  submitting,
}: {
  readonly next: string;
  readonly submitting: boolean;
}) {
  return (
    <Form method="post" className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <EmailField />
      <Field id="password" label="Password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </Form>
  );
}

export function LoginFooter({ showDevHint }: { readonly showDevHint: boolean }) {
  return (
    <>
      <p className="mt-4 text-center text-sm">
        <Link
          to="/internal/forgot-password"
          className="text-muted-foreground underline"
        >
          Forgot your password?
        </Link>
      </p>

      {showDevHint && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Development seed: admin@localhost / admin123
        </p>
      )}
    </>
  );
}
