import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { data, Form, useActionData, useLoaderData, useNavigation } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDate, formatDateTime } from "~/i18n/format";
import { SupportService } from "~/services/support.server";
import { SupportRepo } from "~/models/support.server";
import { statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_KEY } from "~/support/categories";
import { replySchema, updateCcSchema, BODY_MAX, CC_MAX } from "~/schemas/support";
import { supportErrorKey } from "~/support/error-keys";
import { Thread, THREAD_CSS, type ThreadMessage } from "~/components/support/Thread";
import { AttachmentPicker, usePendingUploads } from "~/components/support/AttachmentPicker";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);
  const service = new SupportService();

  const thread = await service.find(session.shop, params.ticketId ?? "");
  if (!thread) throw new Response("Not found", { status: 404 });

  // Opening the thread IS reading it. Done here rather than on an interaction,
  // so the unread badge clears by looking, like every other inbox.
  await service.markMerchantRead(session.shop, thread.ticket.id);

  const messages: ThreadMessage[] = thread.messages.map((message) => ({
    id: message.id,
    author: message.author,
    authorName: message.authorName,
    body: message.body,
    createdAt: message.createdAt,
    attachments: thread.attachments
      .filter((file) => file.messageId === message.id)
      .map((file) => ({
        id: file.id,
        filename: file.filename,
        contentType: file.contentType,
        // Served by our own route — the bucket is private.
        url: `/support/file/${file.id}`,
        isVideo: file.contentType.startsWith("video/"),
      })),
  }));

  return {
    ticket: {
      id: thread.ticket.id,
      subject: thread.ticket.subject,
      category: thread.ticket.category,
      status: statusOf(thread.ticket),
      createdAt: thread.ticket.createdAt,
      ccEmails: thread.ticket.ccEmails,
    },
    messages,
  };
};

/**
 * Command dispatch on `intent` — the action stays a thin lookup and each branch
 * is one call into the service (@rules/design-patterns.md).
 */
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);
  const ticketId = params.ticketId ?? "";
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "reply");
  const service = new SupportService();

  if (intent === "close") {
    const closed = await service.closeAsMerchant(session.shop, ticketId);
    return closed
      ? data({ success: "closed" as const })
      : data({ error: "not_found" as const }, { status: 404 });
  }

  if (intent === "cc") {
    const parsed = updateCcSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) {
      return data({ error: "invalid_cc" as const }, { status: 400 });
    }
    await service.setCcEmails(session.shop, ticketId, parsed.data.ccEmails);
    return data({ success: "ccSaved" as const });
  }

  const parsed = replySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return data({ error: "empty_reply" as const }, { status: 400 });
  }

  // The shop name is the author of its own messages, and it is already stored
  // on the ticket — no Shopify round trip to reply.
  const existing = await service.find(session.shop, ticketId);
  if (!existing) return data({ error: "not_found" as const }, { status: 404 });

  const replied = await service.replyAsMerchant({
    shop: session.shop,
    shopName: existing.ticket.shopName,
    ticketId,
    body: parsed.data.body,
  });
  if (!replied.ok) {
    return data({ error: replied.reason }, { status: replied.reason === "rate_limited" ? 429 : 404 });
  }

  const repo = new SupportRepo();
  const thread = await repo.find(session.shop, ticketId);
  const newest = thread?.messages.at(-1);
  if (newest) {
    const now = Date.now();
    for (const uploadId of parsed.data.uploadIds) {
      const meta = form.get(`upload:${uploadId}`);
      if (typeof meta !== "string") continue;
      const [r2Key, filename, contentType, size] = meta.split("|");
      if (!r2Key || !filename || !contentType) continue;
      await repo.attach({
        shop: session.shop,
        messageId: newest.id,
        id: uploadId,
        r2Key,
        filename,
        contentType,
        sizeBytes: Number(size ?? 0),
        at: now,
      });
    }
  }

  return data({ success: "replied" as const });
};

const STATUS_TONE: Record<SupportStatus, "info" | "success" | "neutral"> = {
  open: "info",
  answered: "success",
  closed: "neutral",
};

export default function SupportThreadPage() {
  const { ticket, messages } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  const uploads = usePendingUploads(ticket.id);

  const busy = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  const error = actionData && "error" in actionData ? actionData.error : undefined;
  const isClosed = ticket.status === "closed";

  return (
    <s-page heading={ticket.subject}>
      <style dangerouslySetInnerHTML={{ __html: THREAD_CSS }} />
      <s-link slot="breadcrumb-actions" href="/app/support">
        {t("support.heading")}
      </s-link>

      {error && (
        <s-section>
          <s-banner tone="critical" heading={t(supportErrorKey(error))}></s-banner>
        </s-section>
      )}

      <s-section heading={t("support.thread.conversation")}>
        <Thread
          messages={messages}
          youLabel={t("support.thread.you")}
          formatWhen={(at) => formatDateTime(locale, at)}
        />
      </s-section>

      <s-section heading={isClosed ? undefined : t("support.thread.reply")}>
        {isClosed ? (
          <s-banner tone="info" heading={t("support.thread.closedNotice")}></s-banner>
        ) : (
          <Form method="post" replace>
            <input type="hidden" name="intent" value="reply" />
            <s-stack direction="block" gap="base">
              <s-text-area
                label={t("support.thread.reply")}
                labelAccessibilityVisibility="exclusive"
                name="body"
                placeholder={t("support.thread.replyPlaceholder")}
                rows={4}
                maxLength={BODY_MAX}
              ></s-text-area>

              <AttachmentPicker
                label={t("support.form.attachments")}
                addLabel={t("support.form.addFiles")}
                uploads={uploads}
                errorLabel={(reason) => t(supportErrorKey(reason))}
              />

              <s-button
                type="submit"
                variant="primary"
                loading={busy && pendingIntent === "reply"}
              >
                {busy && pendingIntent === "reply"
                  ? t("support.thread.sending")
                  : t("support.thread.send")}
              </s-button>
            </s-stack>
          </Form>
        )}
      </s-section>

      <s-box slot="aside">
        <s-section heading={t("support.thread.details")}>
          <s-stack direction="block" gap="base">
            <s-stack direction="block" gap="small-300">
              <s-text color="subdued">{t("support.columns.status")}</s-text>
              <s-badge tone={STATUS_TONE[ticket.status]}>
                {t(`support.status.${ticket.status}`)}
              </s-badge>
            </s-stack>

            <s-stack direction="block" gap="small-300">
              <s-text color="subdued">{t("support.columns.category")}</s-text>
              <s-text>{t(CATEGORY_LABEL_KEY[ticket.category])}</s-text>
            </s-stack>

            <s-stack direction="block" gap="small-300">
              <s-text color="subdued">{t("support.thread.created")}</s-text>
              <s-text>{formatDate(locale, ticket.createdAt)}</s-text>
            </s-stack>

            <s-divider direction="block" />

            {/* Editable after the fact: who needs to see a thread changes as it
                goes on, and re-opening a ticket to add a colleague is worse. */}
            <Form method="post" replace>
              <input type="hidden" name="intent" value="cc" />
              <s-stack direction="block" gap="small-300">
                <s-text-area
                  label={t("support.form.cc")}
                  name="ccEmails"
                  details={t("support.form.ccHelp", { max: CC_MAX })}
                  rows={2}
                  value={ticket.ccEmails.join("\n")}
                ></s-text-area>
                <s-button type="submit" loading={busy && pendingIntent === "cc"}>
                  {t("support.thread.saveCc")}
                </s-button>
              </s-stack>
            </Form>

            {/* Closing lives here rather than in the page's action slot:
                `s-button` has no `form` attribute, so a button in a slot
                outside the form cannot submit it. Beside the details is also
                the better home — it stops a thread-ending action sitting next
                to the primary Reply. A merchant reply reopens it anyway. */}
            {!isClosed && (
              <>
                <s-divider direction="block" />
                <Form method="post" replace>
                  <input type="hidden" name="intent" value="close" />
                  <s-button
                    type="submit"
                    loading={busy && pendingIntent === "close"}
                  >
                    {t("support.thread.close")}
                  </s-button>
                </Form>
              </>
            )}
          </s-stack>
        </s-section>
      </s-box>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
