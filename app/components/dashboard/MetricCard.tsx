type MetricCardProps = {
  label: string;
  value: string;
  change: string;
  href: string;
};

export function MetricCard({ label, value, change, href }: MetricCardProps) {
  return (
    <s-clickable
      href={href}
      paddingBlock="small-400"
      paddingInline="small-100"
      borderRadius="base"
    >
      <s-grid gap="small-300">
        <s-heading>{label}</s-heading>
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-text type="strong">{value}</s-text>
          <s-badge tone="success" icon="arrow-up">
            {change}
          </s-badge>
        </s-stack>
      </s-grid>
    </s-clickable>
  );
}
