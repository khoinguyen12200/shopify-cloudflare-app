import { support } from "~/wiring.server";
import { useEffect, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  data,
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { SaveBar, useAppBridge } from "@shopify/app-bridge-react";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDate, formatDateTime, formatNumber } from "~/i18n/format";
import { supportService } from "~/wiring.server";
import { statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_KEY } from "~/support/categories";
import { replySchema, updateCcSchema, BODY_MAX } from "~/schemas/support";
import { CC_MAX, sameCcList } from "~/support/cc-list";
import { supportErrorKey } from "~/support/error-keys";
import { useActionToast } from "~/admin/use-action-toast";
import { Thread, THREAD_CSS, type ThreadMessage } from "~/components/support/Thread";
import { CcEmails, ccLabels } from "~/components/support/CcEmails";
import { AttachmentPicker } from "~/components/support/AttachmentPicker";
import { usePendingUploads } from "./use-pending-uploads";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);
  const service = supportService();

  const thread = await service.find(session.shop, params.ticketId ?? "");
  if (!thread) throw new Response("Not found", { status: 404 });

  // Opening the thread IS reading it. Done here rather than on an interaction,
  // so the unread badge clears by looking, like every other inbox.
  await service.markMerchantRead(session.shop, thread.ticket.id);

  // Every attachment URL is signed HERE, where the session has just proved this
  // shop owns the thread. The browser cannot prove it again: an <img> inside
  // the Shopify admin iframe sends no session token, which is why these files
  // used to render as a broken link instead of the screenshot.
  const messages: ThreadMessage[] = await Promise.all(
    thread.messages.map(async (message) => ({
      id: message.id,
      author: message.author,
      authorName: message.authorName,
      body: message.body,
      createdAt: message.createdAt,
      attachments: await Promise.all(
        thread.attachments
          .filter((file) => file.messageId === message.id)
          .map(async (file) => ({
            id: file.id,
            filename: file.filename,
            contentType: file.contentType,
            url: await service.attachmentUrl(file.id),
            sizeBytes: file.sizeBytes,
            kind: file.contentType.startsWith("video/") ? "video" : file.contentType.startsWith("image/") ? "image" : "file",
          })),
      ),
    })),
  );

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
 *
 * There is deliberately no `close` intent. Closing is a support decision, not a
 * merchant one: a merchant either stops replying or says it is fixed, and
 * asking them to file the ticket AND tidy it up afterwards is our housekeeping
 * on their screen. Staff close threads from the internal console.
 */
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);
  const ticketId = params.ticketId ?? "";
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "reply");
  const service = supportService();

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

  const thread = await service.find(session.shop, ticketId);
  const newest = thread?.messages.at(-1);
  if (!newest || !(await support().adoptPendingUploads(session.shop, newest.id, parsed.data.uploadIds, Date.now()))) {
    return data({ error: "invalid_upload" as const }, { status: 400 });
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
  const submit = useSubmit();
  const ccForm = useRef<HTMLFormElement>(null);
  const [ccEmails, setCcEmails] = useState<string[]>([...ticket.ccEmails]);

  const busy = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  const error = actionData && "error" in actionData ? actionData.error : undefined;
  const success = actionData && "success" in actionData ? actionData.success : undefined;
  const isClosed = ticket.status === "closed";
  const ccSaving = busy && pendingIntent === "cc";
  const ccDirty = !sameCcList(ccEmails, ticket.ccEmails);

  useActionToast(actionData, {
    error: error ? t(supportErrorKey(error)) : undefined,
    success: success ? t(`support.success.${success}`) : undefined,
  });
  useCreatedToast();

  return (
    <>
      {/*
       * Driven by whether the list actually changed, not by whether the
       * merchant touched the control: the CC list lives in React state, so
       * `data-save-bar`'s automatic dirty tracking — which watches DOM input
       * events — would never see it. `sameCcList` is order- and case-blind, so
       * removing an address and adding it straight back correctly counts as no
       * change.
       */}
      <SaveBar id="thread-cc-save-bar" open={ccDirty}>
        {/* `""` is the HTML boolean-attribute form, and `undefined` omits the
            attribute — `loading={false}` would render `loading="false"`, which
            the element reads as present. */}
        <button
          variant="primary"
          loading={ccSaving ? "" : undefined}
          onClick={() => {
            const form = ccForm.current;
            if (form) void submit(form);
          }}
        >
          {t("common:actions.save")}
        </button>
        <button onClick={() => setCcEmails([...ticket.ccEmails])}>
          {t("common:actions.discard")}
        </button>
      </SaveBar>

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
            downloadLabel={t("support.thread.download")}
            formatFileSize={(sizeBytes) => `${formatNumber(locale, Math.max(1, Math.round(sizeBytes / 1024)))} KB`}
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
                  limitsLabel={t("support.form.attachmentLimits")}
                  uploads={uploads}
                  errorLabel={(reason) => t(supportErrorKey(reason))}
                />

                {/* Sending a message is not saving a record, so this one stays a
                    button in the form rather than moving to the save bar. */}
                <s-stack direction="inline">
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
                  goes on, and re-opening a ticket to add a colleague is worse.

                  No Save button of its own. Unsaved changes belong in the admin's
                  save bar at the top of the frame, and the bar only exists while
                  there is something to save — a Save control sitting in the panel
                  permanently is an invitation to press it when nothing changed.
                  The form stays because it is still the thing that carries the
                  value; the bar just submits it. */}
              <Form method="post" replace ref={ccForm}>
                <input type="hidden" name="intent" value="cc" />
                <CcEmails
                  id="thread-cc"
                  name="ccEmails"
                  emails={ccEmails}
                  onChange={setCcEmails}
                  labels={ccLabels(t, CC_MAX)}
                />
              </Form>
            </s-stack>
          </s-section>
        </s-box>
        </s-page>
    </>
  );
}

/**
 * Confirms the ticket the merchant just filed, on the page they land on.
 *
 * The flag is stripped from the URL immediately so a refresh — or the back
 * button — does not congratulate them a second time for something they did
 * once.
 */
function useCreatedToast() {
  const { t } = useTranslation(["admin", "common"]);
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const created = searchParams.get("created") === "1";

  useEffect(() => {
    if (!created) return;
    shopify.toast.show(t("support.success.created"));
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("created");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [created, shopify, t, setSearchParams]);
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
