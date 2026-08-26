import type { SupportMerchantActivityPayload } from "~/notifications/payloads";
import { Cta, EmailLayout, Muted, P } from "../layout";
import { renderEmail, type RenderedEmail } from "../render";

/**
 * Staff-facing: a merchant opened or replied to a ticket.
 *
 * The shop name goes in the SUBJECT line, because this lands in a shared inbox
 * where the only triage signal is that line — "Support: Alpha Store — checkout
 * is broken" is actionable in a list, "New support ticket" is not.
 * STAFF-FACING, so deliberately English — see @rules/i18n.md. Only the one
 * merchant-facing template (support-staff-reply) is translated.
 */
export function supportMerchantActivityEmail(
  p: SupportMerchantActivityPayload,
): Promise<RenderedEmail> {
  const lead = p.isNew ? "New ticket" : "New reply";

  return renderEmail(
    `${lead}: ${p.shopName} — ${p.subject}`,
    <EmailLayout
      preview={p.excerpt}
      heading={p.subject}
      logoUrl={p.logoUrl}
      locale={p.locale}
    >
      <P>
        {p.shopName} {p.isNew ? "opened a support ticket" : "replied to a support ticket"}.
      </P>
      <P>{p.excerpt}</P>
      <Cta href={p.threadUrl}>Open the ticket</Cta>
      <Muted>
        You are getting this because support notifications are on for your
        account. Turn them off under Support in the internal console.
      </Muted>
    </EmailLayout>,
  );
}
