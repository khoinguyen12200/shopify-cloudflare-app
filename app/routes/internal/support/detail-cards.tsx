import type { ReactNode } from "react";
import { Badge, BlockStack, Card, CardContent, CardHeader, Text } from "ngk-dashboard";
import { Thread, type ThreadMessage } from "~/components/support/Thread";
import { formatDateTime, formatNumber } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import type { SupportStatus } from "~/support/status";
import { STATUS_LABEL, STATUS_VARIANT } from "./status-display";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

function Detail({ label, children }: { readonly label: string; readonly children: ReactNode }) {
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

export function ConversationCard({ messages }: { readonly messages: readonly ThreadMessage[] }) {
  return (
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
          downloadLabel="Download file"
          formatFileSize={(sizeBytes) => `${formatNumber(LOCALE, Math.max(1, Math.round(sizeBytes / 1024)))} KB`}
          formatWhen={(at) => formatDateTime(LOCALE, at, UTC)}
        />
      </CardContent>
    </Card>
  );
}

export interface DetailsCardProps {
  readonly status: SupportStatus;
  readonly shop: string;
  readonly plan: { readonly name: string; readonly status: string } | null;
  readonly createdAt: number;
  readonly merchantEmail: string | null;
  readonly ccEmails: readonly string[];
}

export function DetailsCard({ status, shop, plan, createdAt, merchantEmail, ccEmails }: DetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <Text as="h2" className="font-semibold">
          Details
        </Text>
      </CardHeader>
      <CardContent>
        <BlockStack gap={3}>
          <Detail label="Status">
            <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
          </Detail>
          <Detail label="Shop">{shop}</Detail>
          <Detail label="Plan">{plan ? `${plan.name} · ${plan.status}` : "Free"}</Detail>
          {plan && <Detail label="Subscription">{plan.status}</Detail>}
          <Detail label="Opened">{formatDateTime(LOCALE, createdAt, UTC)}</Detail>
          <Detail label="Reply to">{merchantEmail ?? "In-app only"}</Detail>
          <Detail label="Copied">{ccEmails.length > 0 ? ccEmails.join(", ") : "—"}</Detail>
        </BlockStack>
      </CardContent>
    </Card>
  );
}
