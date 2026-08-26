import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Alert,
  AlertDescription,
  Badge,
  BlockStack,
  Button,
  Card,
  CardContent,
  CardHeader,
  Label,
  Page,
  Text,
  Textarea,
} from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import { SupportService } from "~/services/support.server";
import { SubscriptionEventRepo } from "~/models/subscription-events.server";
import { statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_EN } from "~/support/categories";
import { BODY_MAX } from "~/schemas/support";
import { Thread, THREAD_CSS, type ThreadMessage } from "~/components/support/Thread";
import { formatDateTime } from "~/i18n/format";
import { storedEventPrice } from "~/billing/subscription-event";
import { formatMoney } from "~/money";
import type { Locale } from "~/i18n/config";
import { Sparkles } from "lucide-react";
import { useReplyDraft } from "~/internal/use-reply-draft";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await requireAdminUser(request);
  const service = new SupportService();

  const ticketId = params.ticketId ?? "";
  const thread = await service.findForStaff(ticketId);
  if (!thread) throw new Response("Not found", { status: 404 });

  // Opening it counts as reading it, so the queue's New badge clears by looking.
  await service.markStaffRead(ticketId);

  // The commercial context, so a billing question is answerable here rather
  // than on a second screen.
  const history = await new SubscriptionEventRepo().listForShop(thread.ticket.shop);
  const latest = history[0];

  const messages: ThreadMessage[] = thread.messages.map((message) => ({
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
        isVideo: file.contentType.startsWith("video/"),
      })),
  }));

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
    plan: latest
      ? {
          name: latest.name,
          status: latest.status,
          price: formatMoney(LOCALE, storedEventPrice(latest)),
        }
      : null,
    messages,
  };
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const actor = await requireAdminUser(request);
  const ticketId = params.ticketId ?? "";
  const form = await request.formData();
  const service = new SupportService();

  if (String(form.get("intent")) === "close") {
    await service.closeAsStaff(ticketId);
    return { success: "closed" as const };
  }

  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write a reply first." as const };
  if (body.length > BODY_MAX) return { error: "That reply is too long." as const };

  // The staff member's own name is the author snapshot — never a form field.
  const replied = await service.replyAsStaff({
    ticketId,
    staffName: actor.name,
    body,
  });
  return replied.ok
    ? { success: "replied" as const }
    : { error: "That ticket no longer exists." as const };
};

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Needs reply",
  answered: "Waiting on merchant",
  closed: "Closed",
};

const STATUS_VARIANT: Record<SupportStatus, "default" | "secondary" | "outline"> = {
  open: "default",
  answered: "secondary",
  closed: "outline",
};

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <Text as="span" className="text-sm text-muted-foreground">
        {label}
      </Text>
      <Text as="span" className="text-sm">
        {children}
      </Text>
    </div>
  );
}

export default function InternalSupportThread() {
  const { ticket, messages, plan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  const isClosed = ticket.status === "closed";
  // Targets the composer's textarea by id and appends into it.
  const draft = useReplyDraft("body");

  return (
    <Page
      title={ticket.subject}
      subtitle={`${ticket.shopName || ticket.shop} · ${CATEGORY_LABEL_EN[ticket.category]}`}
      backAction={{ label: "Support", href: "/internal/support" }}
    >
      <style dangerouslySetInnerHTML={{ __html: THREAD_CSS }} />
      <BlockStack gap={4}>
        {actionData && "error" in actionData && (
          <Alert variant="destructive">
            <AlertDescription>{actionData.error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <BlockStack gap={4}>
            <Card>
              <CardHeader>
                <Text as="h2" className="font-semibold">
                  Conversation
                </Text>
              </CardHeader>
              <CardContent>
                <Thread
                  messages={messages}
                  youLabel="You"
                  formatWhen={(at) => formatDateTime(LOCALE, at)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Text as="h2" className="font-semibold">
                  {isClosed ? "Reopen with a reply" : "Reply"}
                </Text>
              </CardHeader>
              <CardContent>
                <Form method="post" className="flex flex-col gap-3">
                  <Label htmlFor="body" className="sr-only">
                    Reply
                  </Label>
                  <Textarea
                    id="body"
                    name="body"
                    rows={5}
                    maxLength={BODY_MAX}
                    placeholder="This reply is emailed to the merchant and their copy list."
                    required
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" disabled={busy}>
                      {busy && !pendingIntent ? "Sending…" : "Send reply"}
                    </Button>
                    {/*
                      A draft, not an answer. It APPENDS into the box above so a
                      half-written reply survives, and a human edits and sends
                      every word — which is what makes this the safe place to
                      put a model.
                    */}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || draft.state === "drafting"}
                      onClick={() => void draft.draft(ticket.id)}
                    >
                      <Sparkles className="mr-1 size-4" />
                      {draft.state === "drafting" ? "Drafting…" : "Draft with AI"}
                    </Button>
                    {!isClosed && (
                      <Button
                        type="submit"
                        name="intent"
                        value="close"
                        variant="outline"
                        disabled={busy}
                      >
                        Close ticket
                      </Button>
                    )}
                  </div>

                  {draft.error && (
                    <Text as="p" className="text-sm text-destructive">
                      {draft.error}
                    </Text>
                  )}
                </Form>
              </CardContent>
            </Card>
          </BlockStack>

          <Card>
            <CardHeader>
              <Text as="h2" className="font-semibold">
                Details
              </Text>
            </CardHeader>
            <CardContent>
              <BlockStack gap={3}>
                <Detail label="Status">
                  <Badge variant={STATUS_VARIANT[ticket.status]}>
                    {STATUS_LABEL[ticket.status]}
                  </Badge>
                </Detail>
                <Detail label="Shop">{ticket.shop}</Detail>
                <Detail label="Plan">
                  {plan ? `${plan.name} · ${plan.price}` : "Free"}
                </Detail>
                {plan && <Detail label="Subscription">{plan.status}</Detail>}
                <Detail label="Opened">
                  {formatDateTime(LOCALE, ticket.createdAt)}
                </Detail>
                <Detail label="Reply to">
                  {ticket.merchantEmail ?? "In-app only"}
                </Detail>
                <Detail label="Copied">
                  {ticket.ccEmails.length > 0 ? ticket.ccEmails.join(", ") : "—"}
                </Detail>
              </BlockStack>
            </CardContent>
          </Card>
        </div>
      </BlockStack>
    </Page>
  );
}
