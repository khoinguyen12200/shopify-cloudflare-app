import { Link } from "react-router";
import {
  Badge,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ngk-dashboard";
import type { SupportStatus } from "~/support/status";
import { CATEGORY_LABEL_EN, type SupportCategory } from "~/support/categories";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import { STATUS_LABEL, STATUS_VARIANT } from "./status-display";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

export interface TicketRowData {
  readonly id: string;
  readonly shop: string;
  readonly shopName: string;
  readonly subject: string;
  readonly category: SupportCategory;
  readonly status: SupportStatus;
  readonly lastMessageAt: number;
  readonly planName: string;
  readonly unread: boolean;
}

function TicketRow({ ticket }: { readonly ticket: TicketRowData }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link to={`/internal/support/${ticket.id}`} prefetch="intent" className="underline">
          {ticket.subject}
        </Link>
        {ticket.unread && (
          <Badge variant="default" className="ml-2">
            New
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{ticket.shopName || ticket.shop}</TableCell>
      <TableCell>
        <Badge variant="outline">{ticket.planName}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">{CATEGORY_LABEL_EN[ticket.category]}</TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABEL[ticket.status]}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDateTime(LOCALE, ticket.lastMessageAt, UTC)}
      </TableCell>
    </TableRow>
  );
}

export function TicketTable({ tickets }: { readonly tickets: readonly TicketRowData[] }) {
  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
