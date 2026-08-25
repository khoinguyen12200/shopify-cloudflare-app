import type { PayloadByEvent } from "~/notifications/payloads";
import type { NotificationEvent } from "~/notifications/types";
import type { RenderedEmail } from "./render";
import { adminPasswordResetEmail } from "./templates/admin-password-reset";
import { supportMerchantActivityEmail } from "./templates/support-merchant-activity";
import { supportStaffReplyEmail } from "./templates/support-staff-reply";

// ─────────────────────────────────────────────────────────────────────────────
// EVENT → EMAIL BUILDER.
//
// `.server.ts` on purpose: this pulls in the whole React Email render tree, and
// `notifications/catalogue.ts` and `notifications/payloads.ts` stay client-safe so
// a settings screen can list events without any of it reaching the browser bundle.
//
// The mapped key type is what makes this extensible safely: add an event to
// `NotificationEvent` and THIS OBJECT stops compiling until it has a builder. A
// plain lookup returning `undefined` would instead give a silent no-send — the
// notification never arrives and nothing anywhere throws.
// ─────────────────────────────────────────────────────────────────────────────

/** Renders one event's payload as an email. Pure apart from rendering. */
type EmailBuilder<E extends NotificationEvent> = (
  payload: PayloadByEvent[E],
) => Promise<RenderedEmail>;

const BUILDERS: { [E in NotificationEvent]: EmailBuilder<E> } = {
  admin_password_reset: adminPasswordResetEmail,
  support_merchant_activity: supportMerchantActivityEmail,
  support_staff_reply: supportStaffReplyEmail,
};

/** Build one event's email. Each builder receives exactly ITS event's payload. */
export function buildEmail<E extends NotificationEvent>(
  event: E,
  payload: PayloadByEvent[E],
): Promise<RenderedEmail> {
  return BUILDERS[event](payload);
}
