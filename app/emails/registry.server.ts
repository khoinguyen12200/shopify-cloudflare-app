import type { NotificationEvent } from "~/notifications/types";
import type { RenderedEmail } from "./render";
import {
  adminPasswordResetEmail,
  type AdminPasswordResetProps,
} from "./templates/admin-password-reset";

// ─────────────────────────────────────────────────────────────────────────────
// EVENT → EMAIL BUILDER.
//
// `.server.ts` on purpose: this pulls in the whole React Email render tree, and
// `app/notifications/catalogue.ts` stays client-safe so a settings screen can
// list events without any of it reaching the browser bundle.
//
// The mapped key type is what makes this extensible safely: add an event to
// `NotificationEvent` and THIS OBJECT stops compiling until it has a builder. A
// plain lookup returning `undefined` would instead give you a silent no-send —
// the notification simply never arrives, and nothing anywhere throws.
// ─────────────────────────────────────────────────────────────────────────────

/** Props each event's email builder takes. One entry per event. */
export interface EmailPropsByEvent
  extends Record<NotificationEvent, { locale?: string; logoUrl?: string }> {
  admin_password_reset: AdminPasswordResetProps;
}

type EmailBuilder<E extends NotificationEvent> = (
  props: EmailPropsByEvent[E],
) => Promise<RenderedEmail>;

const BUILDERS: { [E in NotificationEvent]: EmailBuilder<E> } = {
  admin_password_reset: adminPasswordResetEmail,
};

/** Build one event's email. Each builder receives exactly ITS props type. */
export function buildEmail<E extends NotificationEvent>(
  event: E,
  props: EmailPropsByEvent[E],
): Promise<RenderedEmail> {
  return BUILDERS[event](props);
}
