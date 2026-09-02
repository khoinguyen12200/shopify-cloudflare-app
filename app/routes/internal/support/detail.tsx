import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Textarea,
} from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { supportService } from "~/wiring.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { planForShopifyHandle } from "~/billing/plans";
import { statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_EN } from "~/support/categories";
import { BODY_MAX } from "~/schemas/support";
import { Thread, THREAD_CSS, type ThreadMessage } from "~/components/support/Thread";
import { formatDateTime } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import { Sparkles } from "lucide-react";
import { useReplyDraft } from "~/internal/use-reply-draft";
import {
  DEFAULT_TONE,
  REPLY_TONES,
  TONE_LABEL,
  toReplyTone,
  type ReplyTone,
} from "~/ai/tones";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await requireAdminUser(request, { users: adminUsers() });
  const service = supportService();

  const ticketId = params.ticketId ?? "";
  const thread = await service.findForStaff(ticketId);
  if (!thread) throw new Response("Not found", { status: 404 });

  // Opening it counts as reading it, so the queue's New badge clears by looking.
  await service.markStaffRead(ticketId);

  const current = await new ShopSubscriptionRepo().currentForShop(thread.ticket.shop);

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
    plan: current
      ? {
          name: planForShopifyHandle(current.planHandle)?.name ?? current.planHandle ?? "Free",
          status: current.status,
        }
      : null,
    messages,
  };
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const actor = await requireAdminUser(request, { users: adminUsers() });
  const ticketId = params.ticketId ?? "";
  const form = await request.formData();
  const service = supportService();

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
  // Targets the composer's textarea by id and rewrites what is in it.
  const draft = useReplyDraft("body");
  const [tone, setTone] = useState<ReplyTone>(DEFAULT_TONE);
  const [instruction, setInstruction] = useState("");

  /*
   * The label names the job, so nobody has to guess what pressing it will do to
   * text they have already written. Same three modes the prompt builder picks
   * between — read from the same two inputs, so they cannot disagree.
   */
  const aiMode = instruction.trim() !== "" ? "generate" : "polish-or-suggest";
  const aiActionLabel = aiMode === "generate" ? "Write reply" : "Improve reply";
  const aiActionHint =
    aiMode === "generate"
      ? "Replaces the reply below"
      : "Rewrites what is in the reply below, or suggests one if it is empty";

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
                  {/*
                    The AI box is SEPARATE from the reply box on purpose. What
                    goes here is shorthand — "fix ships friday, say sorry" — and
                    the reply is what comes back. Typing notes into the field
                    that gets emailed and hoping to remember to overwrite them is
                    how a note reaches a merchant.

                    Empty, it falls back to the reply box: polish what is there,
                    or suggest one from the thread. The button says which.
                  */}
                  <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
                    <Label htmlFor="ai-instruction" className="text-xs text-muted-foreground">
                      Tell the AI what to say — it writes the reply below
                    </Label>
                    <Textarea
                      id="ai-instruction"
                      rows={2}
                      value={instruction}
                      onChange={(event) => setInstruction(event.currentTarget.value)}
                      placeholder="fix ships friday, apologise for the delay"
                      disabled={draft.state === "drafting"}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={tone} onValueChange={(next) => setTone(toReplyTone(next))}>
                        <SelectTrigger className="w-40" aria-label="Tone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REPLY_TONES.map((option) => (
                            <SelectItem key={option} value={option}>
                              {TONE_LABEL[option]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy || draft.state === "drafting"}
                        onClick={() =>
                          void draft.draft({ ticketId: ticket.id, tone, instruction })
                        }
                      >
                        <Sparkles className="mr-1 size-4" />
                        {draft.state === "drafting" ? "Writing…" : aiActionLabel}
                      </Button>
                      <Text as="span" className="text-xs text-muted-foreground">
                        {aiActionHint}
                      </Text>
                    </div>
                  </div>

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
                  {plan ? `${plan.name} · ${plan.status}` : "Free"}
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
