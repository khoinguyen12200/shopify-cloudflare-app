import type { ReactNode } from "react";
import { Alert, AlertDescription, Input, Label } from "ngk-dashboard";
import { AppMark, THEME_INIT_SCRIPT } from "~/internal/components";
import { identity } from "~/identity";

/** Centered card frame shared by the signed-out console pages. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      <div className="grid min-h-dvh place-items-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <AppMark className="size-7" />
              <span className="text-lg font-semibold">{identity.brandName}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle}
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export function ErrorAlert({ message }: { readonly message: string }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** A labelled field wrapper: label above its control. */
export function Field({
  id,
  label,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function EmailField() {
  return (
    <Field id="email" label="Email">
      <Input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        required
        autoFocus
      />
    </Field>
  );
}
