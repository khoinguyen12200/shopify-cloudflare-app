import { Card, CardContent, InlineStack, Skeleton } from "ngk-dashboard";

/**
 * Placeholders for streamed regions. `aria-hidden` because they say nothing a
 * screen reader needs; the real content announces itself once it arrives.
 * Shapes mirror the final layout (same Card, same row rhythm) to avoid a jump.
 */

/** A row of KPI cards, matching the `StatCard` rows on the console. */
export function StatRowSkeleton({ count, minWidth = "min-w-48" }: { count: number; minWidth?: "min-w-48" | "min-w-44" }) {
  return (
    <InlineStack aria-hidden gap={4} className={`flex-wrap [&>*]:flex-1 ${minWidth === "min-w-44" ? "[&>*]:min-w-44" : "[&>*]:min-w-48"}`}>
      {Array.from({ length: count }, (_, index) => (
        <Card key={index} className="h-28 p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-8 w-20" />
        </Card>
      ))}
    </InlineStack>
  );
}

/** A table card: a header row and `rows` body rows. */
export function TableSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <Card aria-hidden>
      <CardContent className="p-0">
        <div className="flex h-12 items-center gap-4 border-b px-4">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} className="h-4 flex-1" />
          ))}
        </div>
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex h-14 items-center gap-4 border-b px-4 last:border-b-0">
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton key={column} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
