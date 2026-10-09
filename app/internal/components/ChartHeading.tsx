import { BlockStack, CardHeader, InlineStack, Text } from "ngk-dashboard";

/** A card header: title and period on the left, the headline figure opposite. */
export function ChartHeading({
  title,
  detail,
  figure,
}: {
  title: string;
  detail: string;
  figure: string;
}) {
  return (
    <CardHeader>
      <InlineStack align="start" justify="between" gap={4}>
        <BlockStack gap={1}>
          <Text as="h2" className="font-semibold">
            {title}
          </Text>
          <Text as="p" className="text-sm text-muted-foreground">
            {detail}
          </Text>
        </BlockStack>
        <Text as="p" className="text-2xl font-semibold tabular-nums">
          {figure}
        </Text>
      </InlineStack>
    </CardHeader>
  );
}
