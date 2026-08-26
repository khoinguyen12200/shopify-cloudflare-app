import { buildEmail } from "~/emails/registry.server";
import type { PayloadByEvent } from "../../payloads";
import type { EmailMessage, NotificationEvent } from "../../types";

/**
 * Turn an event and its payload into the email that will be sent.
 *
 * Its own module rather than an inline closure in `notify.server.ts`, because
 * this is where a real defect lived: `EmailMessage.cc` was declared in `types.ts`
 * and forwarded by the transport, but nothing ever set it — so a merchant's
 * support copy list was validated, capped, stored and displayed, and every
 * copied colleague received nothing. A hop that no test could reach is a hop
 * that quietly stopped working.
 *
 * `cc` arrives ALREADY FILTERED (see `~/notifications/copy-recipients`): opted-out
 * addresses removed, the primary recipient excluded, deduped. This function does
 * not re-decide who may be copied — it only renders and addresses.
 */
export async function composeEmailMessage<E extends NotificationEvent>(
  event: E,
  payload: PayloadByEvent[E],
  to: string,
  cc: readonly string[],
): Promise<EmailMessage> {
  const rendered = await buildEmail(event, payload);

  return {
    kind: "email",
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    // Omitted rather than empty. The transport spreads `cc` only when it is a
    // non-empty array, and `cc: []` would be a field claiming a copy list that
    // does not exist. Copied so the message cannot alias the caller's array.
    ...(cc.length > 0 ? { cc: [...cc] } : {}),
  };
}
