import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  closeTicket,
  createTicketOnBehalf,
  getTicketThread,
  listTickets,
  replyToTicket,
  uploadSupportAttachment,
} from "~/services/internal-admin/ops.server";
import { mcpMutation, mcpRead, MUTATION, READ_ONLY, type McpActorContext } from "../helpers";
import { SUPPORT_CATEGORIES } from "~/support/categories";

const CATEGORY_ENUM = z.enum(SUPPORT_CATEGORIES);

const ATTACHMENT_SCHEMA = z.object({
  filename: z.string().min(1).describe("File name, e.g. screenshot.png"),
  contentType: z.string().min(1).describe("MIME type, e.g. image/png, application/pdf"),
  contentBase64: z.string().min(1).describe("Base64 encoded file data"),
});

export function registerTicketTools(server: McpServer, ctx: McpActorContext) {
  server.registerTool(
    "list_tickets",
    {
      title: "List Support Tickets",
      description:
        "List merchant support tickets, optionally filtered by status ('open', 'closed', 'all'), category, or shop domain.",
      inputSchema: {
        status: z.enum(["open", "closed", "all"]).optional().describe("Ticket status filter (default: 'open')"),
        unreadOnly: z.boolean().optional().describe("Only show tickets with unread customer replies"),
        category: z.string().optional().describe("Ticket category filter"),
        shop: z.string().optional().describe("Filter by specific shop domain"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum tickets to return (default: 50)"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("list_tickets", "mcp:read", ctx, async (args) =>
      listTickets({
        status: args.status ?? "open",
        unreadOnly: args.unreadOnly ?? false,
        category: args.category,
        shop: args.shop,
        limit: args.limit ?? 50,
      }),
    ),
  );

  server.registerTool(
    "get_ticket_thread",
    {
      title: "Get Support Ticket Conversation Thread",
      description:
        "Fetches the full support ticket thread including all merchant and staff messages, timestamps, and attachment details. Automatically marks the ticket as read for staff.",
      inputSchema: {
        ticketId: z.string().min(1).describe("The support ticket ID"),
      },
      annotations: READ_ONLY,
    },
    mcpRead("get_ticket_thread", "mcp:read", ctx, async (args) => {
      const thread = await getTicketThread(args.ticketId);
      if (!thread) throw new Error(`Ticket '${args.ticketId}' not found`);
      return thread;
    }),
  );

  server.registerTool(
    "reply_to_ticket",
    {
      title: "Reply to Support Ticket",
      description:
        "Appends an official staff reply to the ticket thread AND sends the notification email to the merchant (including CC recipients). Can attach files via attachments or uploadIds.",
      inputSchema: {
        ticketId: z.string().min(1).describe("The support ticket ID"),
        body: z.string().min(1).max(10000).describe("The reply message body to send to the merchant"),
        staffName: z.string().optional().describe("Staff display name (default: 'Support Team')"),
        uploadIds: z.array(z.string()).optional().describe("Array of pre-uploaded attachment IDs"),
        attachments: z.array(ATTACHMENT_SCHEMA).optional().describe("Array of base64-encoded files to attach directly"),
      },
      annotations: MUTATION,
    },
    mcpMutation("reply_to_ticket", "mcp:tickets:write", ctx, async (args) => {
      const result = await replyToTicket({
        ticketId: args.ticketId,
        body: args.body,
        staffName: args.staffName ?? "Support Team",
        uploadIds: args.uploadIds ?? [],
        attachments: args.attachments ?? [],
      });
      if (!result.ok) throw new Error(`Failed to reply: ticket '${args.ticketId}' not found`);
      return { success: true, ticketId: args.ticketId, messageId: result.value.messageId };
    }),
  );

  server.registerTool(
    "update_ticket_status",
    {
      title: "Update Ticket Status",
      description: "Closes or re-opens a customer support ticket.",
      inputSchema: {
        ticketId: z.string().min(1).describe("The support ticket ID"),
        status: z.enum(["open", "closed"]).describe("The new status for the ticket"),
      },
      annotations: MUTATION,
    },
    mcpMutation("update_ticket_status", "mcp:tickets:write", ctx, async (args) => {
      if (args.status === "closed") {
        const closed = await closeTicket(args.ticketId);
        if (!closed) throw new Error(`Ticket '${args.ticketId}' not found`);
        return { success: true, ticketId: args.ticketId, status: "closed" };
      }
      return { success: true, ticketId: args.ticketId, status: "open" };
    }),
  );

  server.registerTool(
    "create_ticket",
    {
      title: "Create Ticket on Merchant's Behalf",
      description: "Opens a support ticket from our staff side, emails the merchant immediately, and supports attachments.",
      inputSchema: {
        shop: z.string().min(1).describe("The merchant's myshopify domain or store identifier"),
        shopName: z.string().optional().describe("Merchant store name"),
        subject: z.string().min(1).max(200).describe("Ticket subject"),
        body: z.string().min(1).max(10000).describe("Initial message body"),
        category: CATEGORY_ENUM.describe("Ticket category"),
        merchantEmail: z.string().optional().describe("Merchant email address to notify"),
        ccEmails: z.array(z.string()).optional().describe("Additional email addresses to CC"),
        staffName: z.string().optional().describe("Staff display name"),
        uploadIds: z.array(z.string()).optional().describe("Array of pre-uploaded attachment IDs"),
        attachments: z.array(ATTACHMENT_SCHEMA).optional().describe("Array of base64-encoded files to attach directly"),
      },
      annotations: MUTATION,
    },
    mcpMutation("create_ticket", "mcp:tickets:write", ctx, async (args) => {
      const result = await createTicketOnBehalf({
        shop: args.shop,
        shopName: args.shopName,
        subject: args.subject,
        body: args.body,
        category: args.category,
        merchantEmail: args.merchantEmail,
        ccEmails: args.ccEmails ?? [],
        staffName: args.staffName ?? "Support Team",
        uploadIds: args.uploadIds ?? [],
        attachments: args.attachments ?? [],
      });
      if (!result.ok) {
        throw new Error("Failed to create ticket");
      }
      return { success: true, ticketId: result.value.id };
    }),
  );

  server.registerTool(
    "upload_support_attachment",
    {
      title: "Upload Support Attachment",
      description: "Uploads a base64-encoded file (image, video, PDF, document) to R2 storage for attaching to tickets.",
      inputSchema: {
        shop: z.string().min(1).describe("The merchant's shop domain"),
        filename: z.string().min(1).describe("The name of the file"),
        contentType: z.string().min(1).describe("MIME type (e.g. image/png, application/pdf)"),
        contentBase64: z.string().min(1).describe("Base64 encoded file data"),
        ticketId: z.string().optional().describe("Ticket ID if uploading to an existing ticket"),
      },
      annotations: MUTATION,
    },
    mcpMutation("upload_support_attachment", "mcp:tickets:write", ctx, async (args) => {
      const upload = await uploadSupportAttachment({
        shop: args.shop,
        filename: args.filename,
        contentType: args.contentType,
        contentBase64: args.contentBase64,
        ticketId: args.ticketId ?? "new",
      });
      return { success: true, ...upload };
    }),
  );
}
