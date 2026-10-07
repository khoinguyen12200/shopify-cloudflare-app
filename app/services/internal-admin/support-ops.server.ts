import { shops, support, supportService } from "~/wiring.server";
import { getEnv } from "~/request-context.server";
import { attachmentKey, safeFilename, validateUpload } from "~/support/attachment";
import { createShopify } from "~/shopify.server";
import { statusOf } from "~/support/status";
import type { SupportCategory } from "~/support/categories";

export interface AttachmentInput {
  filename: string;
  contentType: string;
  contentBase64: string;
}

/**
 * Strategy: Resolve shop contact info (store name, merchant email, logo)
 * by checking local database shops repository first, then known ticket contacts,
 * falling back to Shopify offline session GraphQL (with auto-backfill to DB).
 */
export async function resolveShopContact(shop: string): Promise<{
  shopName: string;
  merchantEmail: string | null;
  logoUrl: string | null;
}> {
  const shopRow = await shops().get(shop);
  let shopName = shopRow?.name || shop.replace(".myshopify.com", "");
  let merchantEmail = shopRow?.contactEmail || shopRow?.email || null;
  let logoUrl = shopRow?.logoUrl || (shop ? `https://${shop}/favicon.ico` : null);

  if (!merchantEmail) {
    const known = (await support().listKnownContacts())[shop];
    if (known) {
      shopName = shopName || known.shopName;
      merchantEmail = known.merchantEmail;
    }
  }

  if (!merchantEmail) {
    try {
      const { admin } = await createShopify(getEnv()).unauthenticated.admin(shop);
      const res = await admin.graphql(`#graphql
        query ShopContact { shop { id name email contactEmail url } }
      `);
      const data = (await res.json()) as { data?: { shop?: { id?: string; name?: string; email?: string; contactEmail?: string; url?: string } } };
      const contact = data?.data?.shop;
      if (contact) {
        shopName = contact.name || shopName;
        merchantEmail = contact.contactEmail || contact.email || null;
        logoUrl = `https://${shop}/favicon.ico`;
        await shops().recordAuthenticatedIdentity(shop, contact.id || shopRow?.shopifyShopId || "", Date.now(), {
          name: contact.name,
          email: contact.email,
          contactEmail: contact.contactEmail,
          logoUrl,
          url: contact.url,
        });
      }
    } catch {
      // Offline session unavailable or test fixture
    }
  }

  return { shopName, merchantEmail, logoUrl };
}

/**
 * Uploads a base64-encoded file directly to R2 and registers it as a pending upload.
 */
export async function uploadSupportAttachment({
  shop,
  filename,
  contentType,
  contentBase64,
  ticketId = "new",
}: {
  shop: string;
  filename: string;
  contentType: string;
  contentBase64: string;
  ticketId?: string;
}) {
  const binary = Uint8Array.from(atob(contentBase64), (c) => c.charCodeAt(0));
  const check = validateUpload({ contentType, sizeBytes: binary.byteLength });
  if (!check.ok) {
    throw new Error(`Invalid attachment: ${check.reason}`);
  }

  const uploadId = crypto.randomUUID();
  const safeName = safeFilename(filename);
  const r2Key = attachmentKey({ shop, ticketId, uploadId });
  const env = getEnv();

  if (env.UPLOADS) {
    await env.UPLOADS.put(r2Key, binary, {
      httpMetadata: { contentType },
    });
  }

  const now = Date.now();
  await support().stageUpload({
    id: uploadId,
    shop,
    ticketId: ticketId === "new" ? null : ticketId,
    r2Key,
    filename: safeName,
    contentType,
    sizeBytes: binary.byteLength,
    createdAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
  });

  return {
    uploadId,
    upload_id: uploadId,
    filename: safeName,
    contentType,
    content_type: contentType,
    sizeBytes: binary.byteLength,
    size_bytes: binary.byteLength,
  };
}

/**
 * Adopts pending uploads and inline attachments for a specific message.
 */
export async function attachFilesToMessage(
  shop: string,
  messageId: string,
  ticketId: string,
  uploadIds: readonly string[],
  attachments: readonly AttachmentInput[],
) {
  const now = Date.now();
  if (uploadIds.length > 0) {
    await support().adoptPendingUploads(shop, messageId, uploadIds, now);
  }

  for (const att of attachments) {
    const binary = Uint8Array.from(atob(att.contentBase64), (c) => c.charCodeAt(0));
    const check = validateUpload({ contentType: att.contentType, sizeBytes: binary.byteLength });
    if (!check.ok) continue;

    const uploadId = crypto.randomUUID();
    const safeName = safeFilename(att.filename);
    const r2Key = attachmentKey({ shop, ticketId, uploadId });
    const env = getEnv();

    if (env.UPLOADS) {
      await env.UPLOADS.put(r2Key, binary, {
        httpMetadata: { contentType: att.contentType },
      });
    }

    await support().attach({
      id: uploadId,
      messageId,
      shop,
      r2Key,
      filename: safeName,
      contentType: att.contentType,
      sizeBytes: binary.byteLength,
      at: now,
    });
  }
}

/**
 * List support tickets for staff review.
 */
export async function listTickets({
  status = "all",
  unreadOnly = false,
  category,
  shop,
  limit = 50,
}: {
  status?: string;
  unreadOnly?: boolean;
  category?: string;
  shop?: string;
  limit?: number;
} = {}) {
  let tickets = await support().listOpenForStaff();
  if (shop) tickets = tickets.filter((t) => t.shop === shop);
  if (category) tickets = tickets.filter((t) => t.category === category);
  if (status !== "all") {
    tickets = tickets.filter((t) => statusOf(t) === status);
  }
  if (unreadOnly) {
    tickets = tickets.filter((t) => t.lastAuthor === "merchant");
  }

  return tickets.slice(0, limit).map((t) => ({
    id: t.id,
    shop: t.shop,
    shopName: t.shopName,
    subject: t.subject,
    category: t.category,
    status: statusOf(t),
    lastAuthor: t.lastAuthor,
    lastMessageAt: t.lastMessageAt,
    merchantEmail: t.merchantEmail,
    ccEmails: t.ccEmails,
  }));
}

/**
 * Retrieve full thread including messages and attachments.
 */
export async function getTicketThread(ticketId: string) {
  const thread = await support().findForStaff(ticketId);
  if (!thread) return null;

  return {
    ticket: {
      id: thread.ticket.id,
      shop: thread.ticket.shop,
      shopName: thread.ticket.shopName,
      subject: thread.ticket.subject,
      category: thread.ticket.category,
      status: statusOf(thread.ticket),
      merchantEmail: thread.ticket.merchantEmail,
      ccEmails: thread.ticket.ccEmails,
      locale: thread.ticket.locale,
      createdAt: thread.ticket.createdAt,
      closedAt: thread.ticket.closedAt,
    },
    messages: thread.messages.map((m) => {
      const msgAttachments = thread.attachments.filter((a) => a.messageId === m.id);
      return {
        id: m.id,
        author: m.author,
        authorName: m.authorName,
        body: m.body,
        createdAt: m.createdAt,
        attachments: msgAttachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          byteSize: a.sizeBytes,
          mimeType: a.contentType,
        })),
      };
    }),
  };
}

/**
 * Reply to ticket as staff (triggers merchant email and attaches files).
 */
export async function replyToTicket({
  ticketId,
  body,
  staffName = "Support Team",
  uploadIds = [],
  attachments = [],
}: {
  ticketId: string;
  body: string;
  staffName?: string;
  uploadIds?: string[];
  attachments?: AttachmentInput[];
}) {
  const result = await supportService().replyAsStaff({
    ticketId,
    staffName,
    body,
  });

  if (result.ok) {
    await attachFilesToMessage(
      result.value.shop,
      result.value.messageId,
      ticketId,
      uploadIds,
      attachments,
    );
  }

  return result;
}

/**
 * Close ticket as staff.
 */
export async function closeTicket(ticketId: string) {
  return supportService().closeAsStaff(ticketId);
}

/**
 * Create ticket from staff side (emails the merchant).
 * Automatically resolves store name and merchant email from DB / offline session if omitted.
 */
export async function createTicketOnBehalf({
  shop,
  shopName,
  subject,
  body,
  category,
  merchantEmail,
  ccEmails = [],
  staffName = "Support Team",
  uploadIds = [],
  attachments = [],
}: {
  shop: string;
  shopName?: string;
  subject: string;
  body: string;
  category: SupportCategory;
  merchantEmail?: string | null;
  ccEmails?: string[];
  staffName?: string;
  uploadIds?: string[];
  attachments?: AttachmentInput[];
}) {
  let finalShopName = shopName;
  let finalMerchantEmail = merchantEmail;

  if (!finalShopName || !finalMerchantEmail) {
    const resolved = await resolveShopContact(shop);
    finalShopName = finalShopName || resolved.shopName;
    finalMerchantEmail = finalMerchantEmail !== undefined ? finalMerchantEmail : resolved.merchantEmail;
  }

  const result = await supportService().openTicketAsStaff({
    shop,
    shopName: finalShopName,
    subject,
    body,
    category,
    merchantEmail: finalMerchantEmail ?? null,
    ccEmails,
    staffName,
  });

  if (result.ok) {
    await attachFilesToMessage(
      result.value.shop,
      result.value.messageId,
      result.value.id,
      uploadIds,
      attachments,
    );
  }

  return result;
}
