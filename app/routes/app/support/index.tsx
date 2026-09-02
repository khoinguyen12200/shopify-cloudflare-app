import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDate } from "~/i18n/format";
import { supportService } from "~/wiring.server";
import { isUnreadFor, statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_KEY } from "~/support/categories";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);
  const tickets = await supportService().listForShop(session.shop);

  // Derived here, not in the component: the row only renders what it is given,
  // and the status rules live in one pure function (app/support/status.ts).
  return {
    tickets: tickets.map((ticket) => ({
      id: ticket.id,
      subject: ticket.subject,
      category: ticket.category,
      status: statusOf(ticket),
      lastMessageAt: ticket.lastMessageAt,
      unread: isUnreadFor({
        lastMessageAt: ticket.lastMessageAt,
        lastReadAt: ticket.merchantLastReadAt,
      }),
    })),
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

export default function SupportIndex() {
  const { tickets } = useLoaderData<typeof loader>();
  const { t } = useTranslation(["admin", "common"]);
  const locale = useLocale();

  return (
    <s-page heading={t("support.heading")}>
      <s-button slot="primary-action" href="/app/support/new">
        {t("support.newTicket")}
      </s-button>

      {tickets.length === 0 ? <EmptyState /> : (
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
        <s-section padding="none">
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header listSlot="primary">
                {t("support.columns.subject")}
              </s-table-header>
              <s-table-header listSlot="labeled">
                {t("support.columns.category")}
              </s-table-header>
              <s-table-header listSlot="inline">
                {t("support.columns.status")}
              </s-table-header>
              <s-table-header listSlot="secondary">
                {t("support.columns.updated")}
              </s-table-header>
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
                      {ticket.unread && (
                        <s-badge tone="info">{t("support.unread")}</s-badge>
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{t(CATEGORY_LABEL_KEY[ticket.category])}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={STATUS_TONE[ticket.status]}>
                      {t(`support.status.${ticket.status}`)}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {formatDate(locale, ticket.lastMessageAt)}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

/**
 * Nothing to show yet — so the card carries the invitation instead of an
 * apology. Centred on the empty-state composition: one mark, one heading, one
 * sentence saying what will appear here, one action.
 *
 * The mark is a real drawn icon in a tinted tile rather than an illustration,
 * because the alternative is a stock graphic hosted somewhere else that says
 * nothing about support.
 */
function EmptyState() {
  const { t } = useTranslation(["admin", "common"]);

  return (
    <s-section accessibilityLabel={t("support.empty.heading")}>
      <s-grid gap="base" justifyItems="center" paddingBlock="large-400">
        <s-box background="subdued" borderRadius="large" padding="base">
          <s-icon type="chat" size="base" tone="info"></s-icon>
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

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
