import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { authenticateAdmin } from "~/admin/require-merchant.server";
import { settle } from "~/admin/settle.server";
import { Deferred, FailedSection, PendingSection } from "~/components/admin/Deferred";
import { useLocale } from "~/i18n/useLocale";
import { formatDate } from "~/i18n/format";
import { useTimeZone } from "~/i18n/useTimeZone";
import { supportService } from "~/wiring.server";
import { isUnreadFor, statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_KEY } from "~/support/categories";

export const handle = { i18n: ["common", "admin"] };

/** Derived here, not in the component: the row only renders what it is given, and the status rules live in one pure function (app/support/status.ts). */
async function readTickets(shop: string) {
  const tickets = await supportService().listForShop(shop);
  return tickets.map((ticket) => ({
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: statusOf(ticket),
    lastMessageAt: ticket.lastMessageAt,
    unread: isUnreadFor({
      lastMessageAt: ticket.lastMessageAt,
      lastReadAt: ticket.merchantLastReadAt,
    }),
  }));
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Authentication is awaited; the tickets stream so the frame renders at once.
  const { session } = await authenticateAdmin(request);
  return {
    tickets: settle(readTickets(session.shop), {
      event: "admin.support.tickets.failed",
      shop: session.shop,
      route: "app/support",
    }),
  };
};

/**
 * `open` means "waiting on us", so from the MERCHANT's side it is the
 * reassuring state, not an alarming one — hence `info` rather than `warning`.
 * A merchant has done nothing wrong by having an open ticket.
 */
const STATUS_TONE: Record<SupportStatus, "info" | "success" | "neutral"> = {
  open: "info",
  answered: "success",
  closed: "neutral",
};

type TicketRows = Awaited<ReturnType<typeof readTickets>>;

/*
 * `padding="none"` so the table meets the card's edges. A table is a
 * grid of its own, with its own header rule and row separators, and
 * inset inside a padded card it reads as a second, smaller box floating
 * in a bigger one. Full-bleed, the card's edge IS the table's frame.
 *
 * Nothing above the table: the page heading already says Support and
 * the New ticket button already says what to do, so a line of prose
 * repeating both only pushed the merchant's own tickets further down.
 */
function TicketTable({ tickets }: { tickets: TicketRows }) {
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();
  const timeZone = useTimeZone();

  return (
    <s-section padding="none">
      <s-table variant="auto">
        <s-table-header-row>
          <s-table-header listSlot="primary">{t("support.columns.subject")}</s-table-header>
          <s-table-header listSlot="labeled">{t("support.columns.category")}</s-table-header>
          <s-table-header listSlot="inline">{t("support.columns.status")}</s-table-header>
          <s-table-header listSlot="secondary">{t("support.columns.updated")}</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {tickets.map((ticket) => (
            // The whole row is clickable, delegated to the subject link so
            // there is still one real anchor for keyboard and middle-click.
            <s-table-row key={ticket.id} clickDelegate={`ticket-${ticket.id}`}>
              <s-table-cell>
                <s-stack direction="inline" gap="small-300" alignItems="center">
                  <s-link id={`ticket-${ticket.id}`} href={`/app/support/${ticket.id}`}>
                    {ticket.subject}
                  </s-link>
                  {ticket.unread && <s-badge tone="info">{t("support.unread")}</s-badge>}
                </s-stack>
              </s-table-cell>
              <s-table-cell>{t(CATEGORY_LABEL_KEY[ticket.category])}</s-table-cell>
              <s-table-cell>
                <s-badge tone={STATUS_TONE[ticket.status]}>
                  {t(`support.status.${ticket.status}`)}
                </s-badge>
              </s-table-cell>
              <s-table-cell>{formatDate(locale, ticket.lastMessageAt, timeZone)}</s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </s-section>
  );
}

export default function SupportIndex() {
  const { tickets } = useLoaderData<typeof loader>();
  const { t } = useTranslation(["admin", "common"]);

  return (
    <s-page heading={t("support.heading")}>
      <s-button slot="primary-action" href="/app/support/new">
        {t("support.newTicket")}
      </s-button>

      <Deferred
        resolve={tickets}
        pending={<PendingSection label={t("support.loading")} />}
        failed={<FailedSection heading={t("support.loadFailedHeading")} body={t("support.loadFailedBody")} />}
      >
        {(rows) => (rows.length === 0 ? <EmptyState /> : <TicketTable tickets={rows} />)}
      </Deferred>
    </s-page>
  );
}

/**
 * Nothing to show yet — so the card carries the invitation instead of an
 * apology. Centred on the empty-state composition: one mark, one heading, one
 * sentence saying what will appear here, one action.
 *
 * The illustration is local and bounded so it adds context without taking over
 * the empty state or pushing the call to action below the fold.
 */
function EmptyState() {
  const { t } = useTranslation(["admin", "common"]);

  return (
    <s-section accessibilityLabel={t("support.empty.heading")}>
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-box maxInlineSize="180px" maxBlockSize="140px">
          <s-image
            src="/illustrations/support-empty.svg"
            alt={t("support.empty.illustrationAlt")}
            aspectRatio="1/0.77"
            objectFit="contain"
          ></s-image>
        </s-box>

        <s-grid justifyItems="center" maxInlineSize="420px" gap="base">
          <s-stack direction="block" gap="small-400" alignItems="center">
            <s-heading>{t("support.empty.heading")}</s-heading>
            <s-paragraph color="subdued">{t("support.empty.body")}</s-paragraph>
          </s-stack>

          <s-button-group>
            <s-button
              slot="primary-action"
              variant="primary"
              href="/app/support/new"
            >
              {t("support.newTicket")}
            </s-button>
          </s-button-group>
        </s-grid>
      </s-grid>
    </s-section>
  );
}

export const headers: HeadersFunction = (headersArgs) =>
  boundary.headers(headersArgs);
