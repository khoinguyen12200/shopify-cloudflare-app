import type { SupportCategory } from "~/support/categories";

export type SupportAuthor = "merchant" | "staff";

export interface SupportTicket {
  readonly id: string;
  readonly shop: string;
  readonly shopName: string;
  readonly merchantEmail: string | null;
  readonly ccEmails: readonly string[];
  readonly category: SupportCategory;
  readonly subject: string;
  readonly lastAuthor: SupportAuthor;
  readonly lastMessageAt: number;
  readonly closedAt: number | null;
  readonly merchantLastReadAt: number | null;
  readonly staffLastReadAt: number | null;
  readonly locale: string | null;
  readonly createdAt: number;
}

export interface SupportMessage {
  readonly id: string;
  readonly ticketId: string;
  readonly shop: string;
  readonly author: SupportAuthor;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: number;
}

export interface SupportAttachment {
  readonly id: string;
  readonly messageId: string;
  readonly shop: string;
  readonly r2Key: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: number;
}

export interface SupportThread {
  readonly ticket: SupportTicket;
  readonly messages: readonly SupportMessage[];
  readonly attachments: readonly SupportAttachment[];
}
