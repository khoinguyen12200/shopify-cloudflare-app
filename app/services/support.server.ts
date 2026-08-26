import { err, ok, type Result } from "~/lib/result";
import { getEnv } from "~/request-context.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { SupportRepo, type SupportThread } from "~/models/support.server";
import { notify } from "~/notifications/notify.server";
import type { Notifier } from "~/ports/notifier";
import { excerpt } from "~/support/excerpt";
import type { SupportCategory } from "~/support/categories";
import type { SupportTicket } from "~/db/schema";
import {
  ATTACHMENT_TOKEN_TTL_MS,
  signAttachmentToken,
} from "~/support/file-token";

/**
 * Support use cases: the merchant side and the staff side of one thread.
 *
 * Notifications are BEST EFFORT and always last. A mail transport being down
 * must never be the reason a bug report is lost — the ticket is already
 * committed by the time we try, and a failed send leaves a `failed` row in
 * `notification_logs` rather than an exception on the merchant's screen.
 */

export type OpenTicketFailure = "rate_limited";

interface Clock {
  now(): number;
}

const systemClock: Clock = { now: () => Date.now() };

/** Where a thread lives, for the links inside notifications. */
function threadUrls(appUrl: string, ticketId: string) {
  const base = appUrl.replace(/\/+$/, "");
  return {
    merchant: `${base}/app/support/${ticketId}`,
    staff: `${base}/internal/support/${ticketId}`,
  };
}

/**
 * Ticket creation and replies are merchant-triggered writes that cost us rows,
 * storage and staff attention, so they go through the limiter.
 *
 * FAILS OPEN when the binding is absent: a missing limiter must never be the
 * reason a merchant cannot report a bug (@rules/cloudflare.md).
 */
async function withinRateLimit(shop: string): Promise<boolean> {
  const limiter = getEnv().SUPPORT_LIMITER;
  if (!limiter) return true;
  const { success } = await limiter.limit({ key: shop });
  return success;
}

export class SupportService {
  constructor(
    private readonly repo = new SupportRepo(),
    private readonly admins = new AdminUserRepo(),
    private readonly clock: Clock = systemClock,
    /**
     * The email seam, as a PORT (@rules/design-patterns.md). Defaulted to the
     * real one so no call site changes, and injectable so a test can prove what
     * was asked for — an email leaves no database state to assert against, which
     * is precisely how this service shipped for months sending support replies
     * with the merchant's copy list silently dropped.
     */
    private readonly notifier: Notifier = { send: notify },
  ) {}

  /** File a new ticket, then tell the staff who asked to hear about it. */
  async openTicket(input: {
    shop: string;
    shopName: string;
    merchantEmail: string | null;
    ccEmails: readonly string[];
    category: SupportCategory;
    subject: string;
    body: string;
    /**
     * The merchant's language, from the request that opened the ticket. Stored
     * because staff answer from the internal console, whose request knows
     * nothing about the merchant.
     */
    locale?: string | null;
  }): Promise<Result<{ id: string; messageId: string }, OpenTicketFailure>> {
    if (!(await withinRateLimit(input.shop))) return err("rate_limited");

    const created = await this.repo.open({
      ...input,
      // The shop is the author of its own first message.
      authorName: input.shopName,
      locale: input.locale ?? null,
      at: this.clock.now(),
    });

    await this.notifyStaff({
      ticketId: created.id,
      shopName: input.shopName,
      subject: input.subject,
      body: input.body,
      isNew: true,
    });

    return ok(created);
  }

  /** A merchant replies to their own thread. */
  async replyAsMerchant(input: {
    shop: string;
    shopName: string;
    ticketId: string;
    body: string;
  }): Promise<Result<null, OpenTicketFailure | "not_found">> {
    if (!(await withinRateLimit(input.shop))) return err("rate_limited");

    const replied = await this.repo.reply({
      shop: input.shop,
      ticketId: input.ticketId,
      author: "merchant",
      authorName: input.shopName,
      body: input.body,
      at: this.clock.now(),
    });
    if (!replied) return err("not_found");

    const thread = await this.repo.find(input.shop, input.ticketId);
    await this.notifyStaff({
      ticketId: input.ticketId,
      shopName: thread?.ticket.shopName ?? input.shopName,
      subject: thread?.ticket.subject ?? "",
      body: input.body,
      isNew: false,
    });

    return ok(null);
  }

  /** Staff answer any shop's thread, then email the merchant. */
  async replyAsStaff(input: {
    ticketId: string;
    staffName: string;
    body: string;
  }): Promise<Result<null, "not_found">> {
    const replied = await this.repo.replyAsStaff({
      ticketId: input.ticketId,
      authorName: input.staffName,
      body: input.body,
      at: this.clock.now(),
    });
    if (!replied) return err("not_found");

    const thread = await this.repo.findForStaff(input.ticketId);
    if (thread) await this.notifyMerchant(thread, input.staffName, input.body);

    return ok(null);
  }

  /**
   * Tell every opted-in, active staff account. One send each rather than a
   * single message with many recipients, so one bad address cannot suppress
   * the rest and each row in `notification_logs` names one person.
   */
  private async notifyStaff(input: {
    ticketId: string;
    shopName: string;
    subject: string;
    body: string;
    isNew: boolean;
  }): Promise<void> {
    const recipients = await this.admins.supportNotifyRecipients();
    if (recipients.length === 0) return;

    const urls = threadUrls(getEnv().SHOPIFY_APP_URL, input.ticketId);

    for (const recipient of recipients) {
      await this.notifier.send({
        event: "support_merchant_activity",
        to: { email: recipient.email },
        payload: {
          recipientName: recipient.name,
          shopName: input.shopName,
          subject: input.subject,
          excerpt: excerpt(input.body),
          threadUrl: urls.staff,
          isNew: input.isNew,
        },
      });
    }
  }

  /**
   * Email the merchant, if they left an address.
   *
   * Their copy list rides the SAME send rather than becoming extra messages: a
   * copy is a carbon copy of one reply, not a separate notification, so this
   * way everyone sees one thread in their mail client and the send leaves one
   * row in `notification_logs`.
   *
   * `notify` filters the list before it is used — an address that has opted out
   * is dropped, and the merchant is never also copied on their own reply.
   */
  private async notifyMerchant(
    thread: SupportThread,
    staffName: string,
    body: string,
  ): Promise<void> {
    const { ticket } = thread;
    if (!ticket.merchantEmail) return;

    await this.notifier.send({
      event: "support_staff_reply",
      to: { email: ticket.merchantEmail },
      cc: { email: ticket.ccEmails },
      scope: ticket.shop,
      payload: {
        recipientName: ticket.shopName,
        // Answer them in the language they asked in. `undefined` rather than
        // null so the email falls back to the app default.
        locale: ticket.locale ?? undefined,
        staffName,
        subject: ticket.subject,
        excerpt: excerpt(body),
        threadUrl: threadUrls(getEnv().SHOPIFY_APP_URL, ticket.id).merchant,
      },
    });
  }

  /** Everything below is a thin pass-through; the repo owns the scoping. */
  listForShop(shop: string): Promise<SupportTicket[]> {
    return this.repo.listForShop(shop);
  }

  find(shop: string, ticketId: string): Promise<SupportThread | undefined> {
    return this.repo.find(shop, ticketId);
  }

  findForStaff(ticketId: string): Promise<SupportThread | undefined> {
    return this.repo.findForStaff(ticketId);
  }

  listOpenForStaff(): Promise<SupportTicket[]> {
    return this.repo.listOpenForStaff();
  }

  closeAsStaff(ticketId: string): Promise<boolean> {
    return this.repo.closeAsStaff(ticketId, this.clock.now());
  }

  setCcEmails(
    shop: string,
    ticketId: string,
    ccEmails: readonly string[],
  ): Promise<boolean> {
    return this.repo.setCcEmails(shop, ticketId, ccEmails);
  }

  markMerchantRead(shop: string, ticketId: string): Promise<void> {
    return this.repo.markRead(shop, ticketId, "merchant", this.clock.now());
  }

  markStaffRead(ticketId: string): Promise<void> {
    return this.repo.markReadAsStaff(ticketId, this.clock.now());
  }

  /**
   * A URL for one attachment that carries its own authorisation.
   *
   * Called from a loader that has ALREADY proven the caller may read this
   * attachment. The token exists because the browser cannot re-prove it: an
   * `<img>` in the Shopify admin iframe sends no session token and no usable
   * cookie, so `/support/file/:id` has nothing to authenticate against
   * (see app/support/file-token.ts).
   */
  async attachmentUrl(attachmentId: string): Promise<string> {
    const token = await signAttachmentToken({
      secret: getEnv().SHOPIFY_API_SECRET,
      attachmentId,
      expiresAt: this.clock.now() + ATTACHMENT_TOKEN_TTL_MS,
    });
    return `/support/file/${attachmentId}?token=${token}`;
  }
}
