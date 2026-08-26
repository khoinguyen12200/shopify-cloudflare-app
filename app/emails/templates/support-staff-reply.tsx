import type { SupportStaffReplyPayload } from "~/notifications/payloads";
import { Cta, EmailLayout, Muted, P } from "../layout";
import { renderEmail, type RenderedEmail } from "../render";
import { emailT } from "../translate.server";

/**
 * Merchant-facing: we answered their ticket.
 *
 * The excerpt is included rather than only a link, because a merchant checking
 * mail on a phone can often read the whole answer without opening the admin at
 * all — and the ones who do need to reply have the link.
 *
 * TRANSLATED, unlike the two staff-facing templates beside it. This is the one
 * email in the app a merchant reads, so @rules/i18n.md applies in full: it used
 * to be hardcoded English even though the payload already carried `locale`,
 * which meant a Spanish merchant asked a question in Spanish and got answered
 * in English.
 */
export async function supportStaffReplyEmail(
  p: SupportStaffReplyPayload,
): Promise<RenderedEmail> {
  const t = await emailT(p.locale);

  return renderEmail(
    t("support.reply.subject", { subject: p.subject }),
    <EmailLayout
      preview={p.excerpt}
      heading={p.subject}
      logoUrl={p.logoUrl}
      locale={p.locale}
    >
      <P>{t("support.reply.greeting", { name: p.recipientName })}</P>
      <P>{t("support.reply.intro", { staffName: p.staffName })}</P>
      <P>{p.excerpt}</P>
      <Cta href={p.threadUrl}>{t("support.reply.cta")}</Cta>
      <Muted>{t("support.reply.footer")}</Muted>
    </EmailLayout>,
  );
}
