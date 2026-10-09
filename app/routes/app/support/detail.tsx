import { support } from "~/wiring.server";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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
import { useTranslation } from "react-i18next";

import { authenticateAdmin } from "~/admin/require-merchant.server";
import { settle } from "~/admin/settle.server";
import { Deferred, FailedSection, PendingSection } from "~/components/admin/Deferred";
import { useLocale } from "~/i18n/useLocale";
import { formatDate, formatDateTime, formatNumber } from "~/i18n/format";
import { useTimeZone } from "~/i18n/useTimeZone";
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

type SupportService = ReturnType<typeof supportService>;
type Thread = NonNullable<Awaited<ReturnType<SupportService["find"]>>>;

/**
 * Every attachment URL is signed HERE, where the session has just proved this
 * shop owns the thread. The browser cannot prove it again: an <img> inside
 * the Shopify admin iframe sends no session token, which is why these files
 * used to render as a broken link instead of the screenshot.
 */
function threadMessages(service: SupportService, thread: Thread): Promise<ThreadMessage[]> {
  return Promise.all(
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
}

/** `null` when the shop has no such ticket: a value, not a throw, because the page renders it. */
async function readThread(shop: string, ticketId: string) {
  const service = supportService();
  const thread = await service.find(shop, ticketId);
  if (!thread) return null;

  // Opening the thread IS reading it. Done here rather than on an interaction,
  // so the unread badge clears by looking, like every other inbox.
  await service.markMerchantRead(shop, thread.ticket.id);

  return {
    ticket: {
      id: thread.ticket.id,
      subject: thread.ticket.subject,
      category: thread.ticket.category,
      status: statusOf(thread.ticket),
      createdAt: thread.ticket.createdAt,
      ccEmails: thread.ticket.ccEmails,
    },
    messages: await threadMessages(service, thread),
  };
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  // Authentication is awaited; the thread streams so the frame renders at once.
  const { session } = await authenticateAdmin(request);
  return {
    thread: settle(readThread(session.shop, params.ticketId ?? ""), {
      event: "admin.support.thread.failed",
      shop: session.shop,
      route: "app/support/detail",
    }),
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
  const { session } = await authenticateAdmin(request);
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

type ThreadData = NonNullable<Awaited<ReturnType<typeof readThread>>>;
type TicketView = ThreadData["ticket"];

type CcSaveBarProps = {
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
};

/*
 * Driven by whether the list actually changed, not by whether the
 * merchant touched the control: the CC list lives in React state, so
 * `data-save-bar`'s automatic dirty tracking — which watches DOM input
 * events — would never see it. `sameCcList` is order- and case-blind, so
 * removing an address and adding it straight back correctly counts as no
 * change.
 */
function CcSaveBar({ saving, onSave, onDiscard }: CcSaveBarProps) {
  const { t } = useTranslation(["admin", "common"]);
  return (
    <ui-save-bar id="thread-cc-save-bar" discardConfirmation>
      {/* `""` is the HTML boolean-attribute form, and `undefined` omits the
          attribute — `loading={false}` would render `loading="false"`, which
          the element reads as present. */}
      <button variant="primary" loading={saving ? "" : undefined} onClick={onSave}>
        {t("common:actions.save")}
      </button>
      <button onClick={onDiscard}>{t("common:actions.discard")}</button>
    </ui-save-bar>
  );
}

function ConversationSection({ messages }: { messages: ThreadData["messages"] }) {
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  const timeZone = useTimeZone();
  return (
    <s-section heading={t("support.thread.conversation")}>
      <Thread
        messages={messages}
        youLabel={t("support.thread.you")}
        downloadLabel={t("support.thread.download")}
        formatFileSize={(sizeBytes) => `${formatNumber(locale, Math.max(1, Math.round(sizeBytes / 1024)))} KB`}
        formatWhen={(at) => formatDateTime(locale, at, timeZone)}
      />
    </s-section>
  );
}

type ReplySectionProps = {
  isClosed: boolean;
  uploads: ReturnType<typeof usePendingUploads>;
  sending: boolean;
};

function ReplySection({ isClosed, uploads, sending }: ReplySectionProps) {
  const { t } = useTranslation(["admin", "common"]);
  return (
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
              <s-button type="submit" variant="primary" loading={sending}>
                {sending ? t("support.thread.sending") : t("support.thread.send")}
              </s-button>
            </s-stack>
          </s-stack>
        </Form>
      )}
    </s-section>
  );
}

type DetailsAsideProps = {
  ticket: TicketView;
  ccEmails: string[];
  onCcChange: (emails: string[]) => void;
  ccForm: RefObject<HTMLFormElement | null>;
};

function DetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <s-stack direction="block" gap="small-300">
      <s-text color="subdued">{label}</s-text>
      {children}
    </s-stack>
  );
}

function DetailsAside({ ticket, ccEmails, onCcChange, ccForm }: DetailsAsideProps) {
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  const timeZone = useTimeZone();
  return (
    <s-box slot="aside">
      <s-section heading={t("support.thread.details")}>
        <s-stack direction="block" gap="base">
          <DetailField label={t("support.columns.status")}>
            <s-badge tone={STATUS_TONE[ticket.status]}>
              {t(`support.status.${ticket.status}`)}
            </s-badge>
          </DetailField>

          <DetailField label={t("support.columns.category")}>
            <s-text>{t(CATEGORY_LABEL_KEY[ticket.category])}</s-text>
          </DetailField>

          <DetailField label={t("support.thread.created")}>
            <s-text>{formatDate(locale, ticket.createdAt, timeZone)}</s-text>
          </DetailField>

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
              onChange={onCcChange}
              labels={ccLabels(t, CC_MAX)}
            />
          </Form>
        </s-stack>
      </s-section>
    </s-box>
  );
}

function ErrorBanner({ error }: { error: Parameters<typeof supportErrorKey>[0] | undefined }) {
  const { t } = useTranslation(["admin", "common"]);
  if (!error) return null;
  return (
    <s-section>
      <s-banner tone="critical" heading={t(supportErrorKey(error))}></s-banner>
    </s-section>
  );
}

/** Shows the save bar only while the CC list differs from what is stored. */
function useCcSaveBarVisibility(dirty: boolean) {
  useEffect(() => {
    const update = dirty
      ? globalThis.shopify.saveBar.show?.("thread-cc-save-bar")
      : globalThis.shopify.saveBar.hide?.("thread-cc-save-bar");
    void update;
  }, [dirty]);
}

function LoadedThread({ ticket, messages }: ThreadData) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { t } = useTranslation(["admin", "common"]);
  const uploads = usePendingUploads(ticket.id);
  const submit = useSubmit();
  const ccForm = useRef<HTMLFormElement>(null);
  const [ccEmails, setCcEmails] = useState<string[]>([...ticket.ccEmails]);

  const busy = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  const error = actionData && "error" in actionData ? actionData.error : undefined;
  const success = actionData && "success" in actionData ? actionData.success : undefined;
  const ccDirty = !sameCcList(ccEmails, ticket.ccEmails);

  useCcSaveBarVisibility(ccDirty);

  useActionToast(actionData, {
    error: error ? t(supportErrorKey(error)) : undefined,
    success: success ? t(`support.success.${success}`) : undefined,
  });

  return (
    <>
      <CcSaveBar
        saving={busy && pendingIntent === "cc"}
        onSave={() => {
          const form = ccForm.current;
          if (form) void submit(form);
        }}
        onDiscard={() => setCcEmails([...ticket.ccEmails])}
      />

      <s-page heading={ticket.subject}>
        <style dangerouslySetInnerHTML={{ __html: THREAD_CSS }} />
        <s-link slot="breadcrumb-actions" href="/app/support">
          {t("support.heading")}
        </s-link>

        <ErrorBanner error={error} />

        <ConversationSection messages={messages} />
        <ReplySection
          isClosed={ticket.status === "closed"}
          uploads={uploads}
          sending={busy && pendingIntent === "reply"}
        />
        <DetailsAside
          ticket={ticket}
          ccEmails={ccEmails}
          onCcChange={setCcEmails}
          ccForm={ccForm}
        />
      </s-page>
    </>
  );
}

/** The page frame, known before any data: a generic heading and the way back. */
function ThreadFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation(["admin", "common"]);
  return (
    <s-page heading={t("support.thread.pageHeading")}>
      <s-link slot="breadcrumb-actions" href="/app/support">
        {t("support.heading")}
      </s-link>
      {children}
    </s-page>
  );
}

export default function SupportThreadPage() {
  const { thread } = useLoaderData<typeof loader>();
  const { t } = useTranslation(["admin", "common"]);
  const loadFailed = (
    <ThreadFrame>
      <FailedSection heading={t("support.loadFailedHeading")} body={t("support.loadFailedBody")} />
    </ThreadFrame>
  );

  // Independent of the thread, so it fires on arrival rather than after the data.
  useCreatedToast();

  return (
    <Deferred
      resolve={thread}
      pending={<ThreadFrame><PendingSection label={t("support.thread.loading")} /></ThreadFrame>}
      failed={loadFailed}
    >
      {(loaded) =>
        loaded ? (
          <LoadedThread ticket={loaded.ticket} messages={loaded.messages} />
        ) : (
          <ThreadFrame>
            <FailedSection heading={t("support.thread.notFoundHeading")} body={t("support.thread.notFoundBody")} />
          </ThreadFrame>
        )
      }
    </Deferred>
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
  const [searchParams, setSearchParams] = useSearchParams();
  const created = searchParams.get("created") === "1";

  useEffect(() => {
    if (!created) return;
    globalThis.shopify.toast.show(t("support.success.created"));
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("created");
        return next;
      },
      { replace: true, preventScrollReset: true },
    );
  }, [created, t, setSearchParams]);
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
