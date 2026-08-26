import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import {
  supportAttachments,
  supportMessages,
  supportTickets,
  type SupportAttachment,
  type SupportAuthor,
  type SupportMessage,
  type SupportTicket,
} from "~/db/schema";
import type { SupportCategory } from "~/support/categories";

/** A thread: the ticket, its messages oldest-first, and each message's files. */
export interface SupportThread {
  readonly ticket: SupportTicket;
  readonly messages: readonly SupportMessage[];
  readonly attachments: readonly SupportAttachment[];
}

/**
 * The ONLY place the support tables are queried — see @rules/data.md.
 *
 * Every merchant-facing method takes `shop` FIRST and puts it in the `where`,
 * because a ticket id arrives from a URL and is therefore attacker-controlled.
 * The two exceptions are named for what they are: `listOpenForStaff` and
 * `findForStaff` serve the internal console, which is deliberately cross-shop.
 */
export class SupportRepo {
  /**
   * Open a ticket and write its first message together.
   *
   * The ticket's `lastAuthor`/`lastMessageAt` are set from that message rather
   * than defaulted, so the derived status is correct from the first row — there
   * is no moment where a thread exists with no author.
   */
  async open(input: {
    shop: string;
    shopName: string;
    merchantEmail: string | null;
    ccEmails: readonly string[];
    category: SupportCategory;
    subject: string;
    body: string;
    authorName: string;
    /** The merchant's language when they opened it. Null if we never knew. */
    locale: string | null;
    at: number;
  }): Promise<{ id: string; messageId: string }> {
    const id = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const db = getDb();

    await db.insert(supportTickets).values({
      id,
      shop: input.shop,
      shopName: input.shopName,
      merchantEmail: input.merchantEmail,
      ccEmails: [...input.ccEmails],
      category: input.category,
      subject: input.subject,
      lastAuthor: "merchant",
      lastMessageAt: input.at,
      locale: input.locale,
      createdAt: input.at,
    });

    await db.insert(supportMessages).values({
      id: messageId,
      ticketId: id,
      shop: input.shop,
      author: "merchant",
      authorName: input.authorName,
      body: input.body,
      createdAt: input.at,
    });

    return { id, messageId };
  }

  /** A merchant's own thread. Undefined for any other shop's id. */
  async find(shop: string, ticketId: string): Promise<SupportThread | undefined> {
    const [ticket] = await getDb()
      .select()
      .from(supportTickets)
      .where(and(eq(supportTickets.shop, shop), eq(supportTickets.id, ticketId)))
      .limit(1);

    return ticket ? this.hydrate(ticket) : undefined;
  }

  /** The same thread for staff, who are not shop-scoped. */
  async findForStaff(ticketId: string): Promise<SupportThread | undefined> {
    const [ticket] = await getDb()
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, ticketId))
      .limit(1);

    return ticket ? this.hydrate(ticket) : undefined;
  }

  /** Messages and attachments for one ticket, in two queries — never one per row. */
  private async hydrate(ticket: SupportTicket): Promise<SupportThread> {
    const db = getDb();
    const messages = await db
      .select()
      .from(supportMessages)
      .where(eq(supportMessages.ticketId, ticket.id))
      .orderBy(asc(supportMessages.createdAt));

    const attachments =
      messages.length === 0
        ? []
        : await db
            .select()
            .from(supportAttachments)
            .where(
              inArray(
                supportAttachments.messageId,
                messages.map((message) => message.id),
              ),
            )
            .orderBy(asc(supportAttachments.createdAt));

    return { ticket, messages, attachments };
  }

  /** A merchant's tickets, most recently active first. */
  async listForShop(shop: string): Promise<SupportTicket[]> {
    return getDb()
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.shop, shop))
      .orderBy(desc(supportTickets.lastMessageAt));
  }

  /**
   * The staff queue: every live thread across every shop, most recently active
   * first. Closed threads are excluded — they are not work.
   */
  async listOpenForStaff(): Promise<SupportTicket[]> {
    return getDb()
      .select()
      .from(supportTickets)
      .where(isNull(supportTickets.closedAt))
      .orderBy(desc(supportTickets.lastMessageAt));
  }

  /**
   * Append a message and move the thread's two derived facts in the same
   * operation, so status can never lag the conversation.
   *
   * A MERCHANT reply reopens a closed thread; a staff reply does not, so a
   * closing note does not put the thread back in the queue. Returns false when
   * the ticket does not belong to `shop` — pass the staff shop to bypass, which
   * `replyAsStaff` does explicitly.
   */
  async reply(input: {
    shop: string;
    ticketId: string;
    author: SupportAuthor;
    authorName: string;
    body: string;
    at: number;
  }): Promise<boolean> {
    const db = getDb();
    const [ticket] = await db
      .select({ id: supportTickets.id })
      .from(supportTickets)
      .where(and(eq(supportTickets.shop, input.shop), eq(supportTickets.id, input.ticketId)))
      .limit(1);
    if (!ticket) return false;

    await this.appendMessage(input.shop, input);
    return true;
  }

  /** Staff answer any shop's thread, so this one is not shop-scoped by design. */
  async replyAsStaff(input: {
    ticketId: string;
    authorName: string;
    body: string;
    at: number;
  }): Promise<{ shop: string; messageId: string } | undefined> {
    const [ticket] = await getDb()
      .select({ shop: supportTickets.shop })
      .from(supportTickets)
      .where(eq(supportTickets.id, input.ticketId))
      .limit(1);
    if (!ticket) return undefined;

    const messageId = await this.appendMessage(ticket.shop, {
      ...input,
      author: "staff",
    });
    return { shop: ticket.shop, messageId };
  }

  private async appendMessage(
    shop: string,
    input: {
      ticketId: string;
      author: SupportAuthor;
      authorName: string;
      body: string;
      at: number;
    },
  ): Promise<string> {
    const db = getDb();
    const messageId = crypto.randomUUID();

    await db.insert(supportMessages).values({
      id: messageId,
      ticketId: input.ticketId,
      shop,
      author: input.author,
      authorName: input.authorName,
      body: input.body,
      createdAt: input.at,
    });

    await db
      .update(supportTickets)
      .set({
        lastAuthor: input.author,
        lastMessageAt: input.at,
        // A merchant coming back reopens the thread; staff closing it does not
        // undo itself. `undefined` leaves the column alone.
        ...(input.author === "merchant" ? { closedAt: null } : {}),
      })
      .where(eq(supportTickets.id, input.ticketId));

    return messageId;
  }

  /**
   * Close a thread. Staff only, hence not shop-scoped: a merchant never closes
   * their own ticket — they either stop replying or say it is fixed, and
   * support decides the thread is done.
   */
  async closeAsStaff(ticketId: string, at: number): Promise<boolean> {
    const result = await getDb()
      .update(supportTickets)
      .set({ closedAt: at })
      .where(eq(supportTickets.id, ticketId))
      .returning({ id: supportTickets.id });
    return result.length > 0;
  }

  /** Stamp one side's read receipt. The other side's is never touched. */
  async markRead(
    shop: string,
    ticketId: string,
    side: SupportAuthor,
    at: number,
  ): Promise<void> {
    await getDb()
      .update(supportTickets)
      .set(
        side === "staff" ? { staffLastReadAt: at } : { merchantLastReadAt: at },
      )
      .where(and(eq(supportTickets.shop, shop), eq(supportTickets.id, ticketId)));
  }

  /** Staff read receipt, not shop-scoped. */
  async markReadAsStaff(ticketId: string, at: number): Promise<void> {
    await getDb()
      .update(supportTickets)
      .set({ staffLastReadAt: at })
      .where(eq(supportTickets.id, ticketId));
  }

  /** Replace the CC list on a merchant's own ticket. */
  async setCcEmails(
    shop: string,
    ticketId: string,
    ccEmails: readonly string[],
  ): Promise<boolean> {
    const result = await getDb()
      .update(supportTickets)
      .set({ ccEmails: [...ccEmails] })
      .where(and(eq(supportTickets.shop, shop), eq(supportTickets.id, ticketId)))
      .returning({ id: supportTickets.id });
    return result.length > 0;
  }

  /**
   * One attachment by id, for the route that streams it back.
   *
   * Returns the owning shop so the caller can compare it against the session
   * rather than trusting the id — the id is in a URL a merchant could edit.
   */
  async findAttachment(id: string): Promise<SupportAttachment | undefined> {
    const [row] = await getDb()
      .select()
      .from(supportAttachments)
      .where(eq(supportAttachments.id, id))
      .limit(1);
    return row;
  }

  /** Record an uploaded file against a message. */
  async attach(input: {
    shop: string;
    messageId: string;
    id: string;
    r2Key: string;
    filename: string;
    contentType: string;
    sizeBytes: number;
    at: number;
  }): Promise<void> {
    await getDb().insert(supportAttachments).values({
      id: input.id,
      messageId: input.messageId,
      shop: input.shop,
      r2Key: input.r2Key,
      filename: input.filename,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      createdAt: input.at,
    });
  }

  /**
   * Delete every support row for a shop and RETURN the R2 keys that were
   * attached to them.
   *
   * The caller deletes the blobs. Keys are collected first because the rows are
   * the only record of them: dropping the rows first would leave the objects
   * unreachable and still billed. `shop` is on every table for exactly this —
   * no join is needed to know what belongs to whom.
   */
  async purgeShop(shop: string): Promise<{ r2Keys: string[]; rows: number }> {
    const db = getDb();
    const keys = await db
      .select({ r2Key: supportAttachments.r2Key })
      .from(supportAttachments)
      .where(eq(supportAttachments.shop, shop));

    // Counted, not just deleted: a data-deletion request has to be able to say
    // HOW MUCH was erased, and `affected: 0` is indistinguishable from "we
    // forgot this table" without it.
    const deleted = await Promise.all([
      db
        .delete(supportAttachments)
        .where(eq(supportAttachments.shop, shop))
        .returning({ id: supportAttachments.id }),
      db
        .delete(supportMessages)
        .where(eq(supportMessages.shop, shop))
        .returning({ id: supportMessages.id }),
      db
        .delete(supportTickets)
        .where(eq(supportTickets.shop, shop))
        .returning({ id: supportTickets.id }),
    ]);

    return {
      r2Keys: keys.map((row) => row.r2Key),
      rows: deleted.reduce((total, rows) => total + rows.length, 0),
    };
  }
}
