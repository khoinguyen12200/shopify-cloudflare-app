import type { AdminPasswordResetPayload } from "~/notifications/payloads";
import { Cta, EmailLayout, Muted, P } from "../layout";
import { renderEmail, type RenderedEmail } from "../render";

/**
 * One builder per notification: a thin JSX composition over the shared layout.
 * Copy lives here; structure lives in `layout.tsx`.
 *
 * Pure apart from rendering — no `getEnv()`, no database, no clock. Everything it
 * needs arrives on the payload, which is what makes it renderable in a test with
 * no request context.
 */
export function adminPasswordResetEmail(
  p: AdminPasswordResetPayload,
): Promise<RenderedEmail> {
  return renderEmail(
    "Reset your password",
    <EmailLayout
      preview="Choose a new password for your account."
      heading="Reset your password"
      logoUrl={p.logoUrl}
      locale={p.locale}
    >
      <P>Hello {p.recipientName},</P>
      <P>Someone asked to reset the password for your account.</P>
      <Cta href={p.resetUrl}>Choose a new password</Cta>
      <Muted>
        This link expires in {p.expiresIn} and can only be used once.
      </Muted>
      <Muted>
        If this was not you, ignore this email — your password has not changed.
      </Muted>
    </EmailLayout>,
  );
}
