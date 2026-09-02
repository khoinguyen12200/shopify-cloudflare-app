import type { SupportCategory } from "~/support/categories";
import type { SupportAuthor, SupportThread, SupportTicket } from "~/support/types";

export type { SupportThread } from "~/support/types";

export interface SupportRepository {
  open(input: { shop: string; shopName: string; merchantEmail: string | null; ccEmails: readonly string[]; category: SupportCategory; subject: string; body: string; authorName: string; locale: string | null; at: number }): Promise<{ id: string; messageId: string }>;
  reply(input: { shop: string; ticketId: string; author: SupportAuthor; authorName: string; body: string; at: number }): Promise<boolean>;
  replyAsStaff(input: { ticketId: string; authorName: string; body: string; at: number }): Promise<{ shop: string; messageId: string } | undefined>;
  find(shop: string, ticketId: string): Promise<SupportThread | undefined>;
  findForStaff(ticketId: string): Promise<SupportThread | undefined>;
  listForShop(shop: string): Promise<SupportTicket[]>;
  listOpenForStaff(): Promise<SupportTicket[]>;
  closeAsStaff(ticketId: string, at: number): Promise<boolean>;
  setCcEmails(shop: string, ticketId: string, ccEmails: readonly string[]): Promise<boolean>;
  markRead(shop: string, ticketId: string, side: "merchant" | "staff", at: number): Promise<void>;
  markReadAsStaff(ticketId: string, at: number): Promise<void>;
}

export interface SupportAdminPort {
  supportNotifyRecipients(): Promise<readonly { name: string; email: string }[]>;
}
