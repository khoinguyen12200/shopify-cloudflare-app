import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useTranslation } from "react-i18next";

import { createShopify } from "~/shopify.server";
import { getEnv } from "~/request-context.server";
import { useLocale } from "~/i18n/useLocale";
import { formatDate } from "~/i18n/format";
import { SupportService } from "~/services/support.server";
import { isUnreadFor, statusOf, type SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_KEY } from "~/support/categories";

export const handle = { i18n: ["common", "admin"] };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await createShopify(getEnv()).authenticate.admin(request);
  const tickets = await new SupportService().listForShop(session.shop);

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

      {tickets.length === 0 ? (
        <s-section heading={t("support.empty.heading")}>
          <s-stack direction="block" gap="base">
            <s-paragraph color="subdued">{t("support.empty.body")}</s-paragraph>
            <s-button variant="primary" href="/app/support/new">
              {t("support.newTicket")}
            </s-button>
          </s-stack>
        </s-section>
      ) : (
        <s-section>
          <s-paragraph color="subdued">{t("support.body")}</s-paragraph>
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

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
