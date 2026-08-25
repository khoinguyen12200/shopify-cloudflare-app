import type { SupportStaffReplyPayload } from "~/notifications/payloads";
import { Cta, EmailLayout, Muted, P } from "../layout";
import { renderEmail, type RenderedEmail } from "../render";

/**
 * Merchant-facing: we answered their ticket.
 *
 * The excerpt is included rather than only a link, because a merchant checking
 * mail on a phone can often read the whole answer without opening the admin at
 * all — and the ones who do need to reply have the link.
 */
export function supportStaffReplyEmail(
  p: SupportStaffReplyPayload,
): Promise<RenderedEmail> {
  return renderEmail(
    `Re: ${p.subject}`,
    <EmailLayout
      preview={p.excerpt}
      heading={p.subject}
      logoUrl={p.logoUrl}
      locale={p.locale}
    >
      <P>Hello {p.recipientName},</P>
      <P>{p.staffName} replied to your support ticket:</P>
      <P>{p.excerpt}</P>
      <Cta href={p.threadUrl}>Read and reply</Cta>
      <Muted>
        Replying in the app keeps the whole conversation in one place, so
        whoever picks it up next has the history.
      </Muted>
    </EmailLayout>,
  );
}
