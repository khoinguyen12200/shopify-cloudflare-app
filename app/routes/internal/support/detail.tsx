import { shopSubscriptions, adminSessionUsers } from "~/wiring.server";
import { useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "Support Ticket · Staff Console" },
];
import { Alert, AlertDescription, BlockStack, CardSkeleton, EmptyState, Page, Text } from "ngk-dashboard";
import { LifeBuoy } from "lucide-react";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { supportService } from "~/wiring.server";
import { replyToTicket, closeTicket } from "~/services/internal-admin/ops.server";
import { planForShopifyHandle } from "~/billing/plans";
import { statusOf } from "~/support/status";
import { CATEGORY_LABEL_EN } from "~/support/categories";
import { BODY_MAX } from "~/schemas/support";
import { THREAD_CSS, type ThreadMessage } from "~/components/support/Thread";
import { Deferred } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
import { ConversationCard, DetailsCard } from "./detail-cards";
import { ReplyCard } from "./detail-reply-card";

type StaffThread = NonNullable<Awaited<ReturnType<ReturnType<typeof supportService>["findForStaff"]>>>;

function toThreadMessages(thread: StaffThread): ThreadMessage[] {
  return thread.messages.map((message) => ({
    id: message.id,
    // From the staff side the sides are swapped: OUR messages are the ones on
    // the right, so `merchant` maps to "them". The component keys off
    // `author === "merchant"`, so flip it here rather than duplicating the view.
    author: message.author === "staff" ? "merchant" : "staff",
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt,
    attachments: thread.attachments
      .filter((file) => file.messageId === message.id)
      .map((file) => ({
        id: file.id,
        filename: file.filename,
        contentType: file.contentType,
        url: `/support/file/${file.id}`,
        sizeBytes: file.sizeBytes,
        kind: file.contentType.startsWith("video/") ? "video" : file.contentType.startsWith("image/") ? "image" : "file",
      })),
  }));
}

/** The whole ticket view, or `null` when there is no such ticket. */
async function loadTicketDetail(ticketId: string) {
  const service = supportService();
  const thread = await service.findForStaff(ticketId);
  if (!thread) return null;

  // Opening it counts as reading it, so the queue's New badge clears by looking.
  await service.markStaffRead(ticketId);

  const current = await shopSubscriptions().currentForShop(thread.ticket.shop);

  return {
    ticket: {
      id: thread.ticket.id,
      shop: thread.ticket.shop,
      shopName: thread.ticket.shopName,
      subject: thread.ticket.subject,
      category: thread.ticket.category,
      status: statusOf(thread.ticket),
      createdAt: thread.ticket.createdAt,
      merchantEmail: thread.ticket.merchantEmail,
      ccEmails: thread.ticket.ccEmails,
    },
    plan: current
      ? {
          name: planForShopifyHandle(current.planHandle)?.name ?? current.planHandle ?? "Free",
          status: current.status,
        }
      : null,
    messages: toThreadMessages(thread),
  };
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminSessionUsers() });
  const ticketId = params.ticketId ?? "";

  // Only auth is awaited; the ticket streams in. A missing ticket resolves to
  // `null`, rendered as a not-found state in the region.
  return { ticketId, detail: streamRegion("support_detail", "ticket", loadTicketDetail(ticketId)) };
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const actor = await requireAdminUser(request, { users: adminUsers() });
  const ticketId = params.ticketId ?? "";
  const form = await request.formData();

  if (String(form.get("intent")) === "close") {
    await closeTicket(ticketId);
    return { success: "closed" as const };
  }

  const body = String(form.get("body") ?? "").trim();
  const uploadIds = String(form.get("uploadIds") ?? "").split(",").filter(Boolean);
  if (!body && uploadIds.length === 0) return { error: "Write a reply or attach a file first." as const };
  if (body.length > BODY_MAX) return { error: "That reply is too long." as const };

  const replied = await replyToTicket({
    ticketId,
    staffName: actor.name,
    body,
    uploadIds,
  });
  if (!replied.ok) return { error: "That ticket no longer exists." as const };

  return { success: "replied" as const };
};

export default function InternalSupportThread() {
  const { ticketId, detail } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <Page title="Support ticket" backAction={{ label: "Support", href: "/internal/support" }}>
      <style dangerouslySetInnerHTML={{ __html: THREAD_CSS }} />
      <BlockStack gap={4}>
        {actionData && "error" in actionData && (
          <Alert variant="destructive">
            <AlertDescription>{actionData.error}</AlertDescription>
          </Alert>
        )}

        <Deferred resolve={detail} resetKey={ticketId} fallback={<TicketSkeleton />} errorTitle="This ticket">
          {(loaded) => (loaded ? <TicketBody {...loaded} /> : <TicketNotFound />)}
        </Deferred>
      </BlockStack>
    </Page>
  );
}

type LoadedTicket = NonNullable<Awaited<ReturnType<typeof loadTicketDetail>>>;

function TicketBody({ ticket, messages, plan }: LoadedTicket) {
  return (
    <BlockStack gap={4}>
      <div>
        <Text as="h2" className="text-lg font-semibold">
          {ticket.subject}
        </Text>
        <Text as="p" className="text-sm text-muted-foreground">
          {`${ticket.shopName || ticket.shop} · ${CATEGORY_LABEL_EN[ticket.category]}`}
        </Text>
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
        <BlockStack gap={4}>
          <ConversationCard messages={messages} />
          <ReplyCard ticketId={ticket.id} isClosed={ticket.status === "closed"} />
        </BlockStack>

        <DetailsCard
          status={ticket.status}
          shop={ticket.shop}
          plan={plan}
          createdAt={ticket.createdAt}
          merchantEmail={ticket.merchantEmail}
          ccEmails={ticket.ccEmails}
        />
      </div>
    </BlockStack>
  );
}

function TicketNotFound() {
  return (
    <EmptyState heading="Ticket not found" icon={LifeBuoy}>
      It may have been removed. Go back to the queue to pick another.
    </EmptyState>
  );
}

/** Mirrors the body: a conversation and reply box beside a details column. */
function TicketSkeleton() {
  return (
    <div aria-hidden className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
      <div className="flex flex-col gap-4">
        <CardSkeleton lines={6} />
        <CardSkeleton lines={4} />
      </div>
      <CardSkeleton lines={6} />
    </div>
  );
}
