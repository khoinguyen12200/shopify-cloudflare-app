import { useState } from "react";
import {
  Badge,
  BlockStack,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  InlineStack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from "ngk-dashboard";
import { Store } from "lucide-react";
import { Link } from "react-router";
import {
  filterMerchantFeedback,
  formatReason,
  type RawUninstallFeedback,
} from "~/domain/uninstall-feedback";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";

const LOCALE: Locale = "en";

function shopLabel(item: RawUninstallFeedback): string {
  return item.shopName ? `${item.shopName} (${item.shop})` : item.shop;
}

/** List of written feedback comments left by departing merchants. */
export function UninstallFeedbackList({
  feedback,
}: {
  feedback: readonly RawUninstallFeedback[];
}) {
  const [activeItem, setActiveItem] = useState<RawUninstallFeedback | null>(null);
  const itemsWithText = filterMerchantFeedback(feedback);

  return (
    <Card>
      <CardHeader>
        <InlineStack align="start" justify="between" gap={4}>
          <BlockStack gap={1}>
            <Text as="h2" className="font-semibold">
              Merchant exit comments
            </Text>
            <Text as="p" className="text-sm text-muted-foreground">
              Written feedback submitted by merchants upon uninstalling
            </Text>
          </BlockStack>
          <Text as="p" className="text-2xl font-semibold tabular-nums">
            {String(itemsWithText.length)}
          </Text>
        </InlineStack>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="[&_th]:h-12 [&_th]:px-4 [&_td]:px-4 [&_td]:py-3">
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">Shop</TableHead>
              <TableHead className="w-1/6">Reason</TableHead>
              <TableHead>Feedback</TableHead>
              <TableHead className="w-40 text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itemsWithText.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-28 text-center text-muted-foreground">
                  No merchant exit feedback submitted yet.
                </TableCell>
              </TableRow>
            ) : (
              itemsWithText.map((item) => (
                <FeedbackRow key={item.eventId} item={item} onOpen={setActiveItem} />
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      <FeedbackDialog item={activeItem} onClose={() => setActiveItem(null)} />
    </Card>
  );
}

function FeedbackRow({
  item,
  onOpen,
}: {
  item: RawUninstallFeedback;
  onOpen: (item: RawUninstallFeedback) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {item.logoUrl ? (
            <img src={item.logoUrl} alt="" className="size-5 rounded object-cover" />
          ) : (
            <Store className="size-5 shrink-0 text-muted-foreground" />
          )}
          <Link
            to={`/internal/shops/${encodeURIComponent(item.shop)}`}
            className="hover:underline"
          >
            {shopLabel(item)}
          </Link>
        </div>
      </TableCell>
      <TableCell>
        {item.reason ? (
          <Badge variant="outline" className="text-xs">
            {formatReason(item.reason)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="max-w-md">
        <div className="flex flex-col gap-1.5">
          <p
            className="line-clamp-3 text-sm italic text-foreground [overflow-wrap:anywhere] break-words cursor-pointer hover:text-foreground/80"
            onClick={() => onOpen(item)}
            title="Click to view full message"
          >
            "{item.reasonDescription}"
          </p>
          {(item.reasonDescription?.length ?? 0) > 80 && (
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="self-start text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              View full message
            </button>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {formatDateTime(LOCALE, item.occurredAt, UTC)}
      </TableCell>
    </TableRow>
  );
}

function FeedbackDialog({
  item,
  onClose,
}: {
  item: RawUninstallFeedback | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Merchant exit feedback</DialogTitle>
          {item && (
            <DialogDescription>
              {shopLabel(item)} · {formatDateTime(LOCALE, item.occurredAt, UTC)}
            </DialogDescription>
          )}
        </DialogHeader>
        {item && (
          <div className="flex flex-col gap-4 py-2">
            {item.reason && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Reason:</span>
                <Badge variant="outline">{formatReason(item.reason)}</Badge>
              </div>
            )}
            <div className="max-h-72 overflow-y-auto rounded-md bg-muted/40 p-4 text-sm leading-relaxed text-foreground [overflow-wrap:anywhere] whitespace-pre-wrap italic">
              "{item.reasonDescription}"
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
