type GuideStepProps = {
  title: string;
  body: string;
  action: string;
  href: string;
  image: string;
  alt: string;
  expanded: boolean;
  onToggle: () => void;
  complete?: boolean;
  toggleLabel: string;
};

function GuideStepDetails({
  body,
  action,
  href,
  image,
  alt,
}: Pick<GuideStepProps, "body" | "action" | "href" | "image" | "alt">) {
  return (
    <s-box padding="base" background="subdued" borderRadius="base">
      <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="center">
        <s-grid gap="small-200">
          <s-paragraph>{body}</s-paragraph>
          <s-button variant="primary" href={href}>
            {action}
          </s-button>
        </s-grid>
        <s-box maxBlockSize="80px" maxInlineSize="80px">
          <s-image src={image} alt={alt} objectFit="contain"></s-image>
        </s-box>
      </s-grid>
    </s-box>
  );
}

export function GuideStep({
  title,
  body,
  action,
  href,
  image,
  alt,
  expanded,
  onToggle,
  complete = false,
  toggleLabel,
}: GuideStepProps) {
  return (
    <s-box>
      <s-grid gridTemplateColumns="1fr auto" gap="base" padding="small">
        <s-checkbox label={title} checked={complete} disabled></s-checkbox>
        <s-button
          accessibilityLabel={toggleLabel}
          variant="tertiary"
          icon={expanded ? "chevron-up" : "chevron-down"}
          onClick={onToggle}
        ></s-button>
      </s-grid>
      <s-box
        padding="small"
        paddingBlockStart="none"
        display={expanded ? "auto" : "none"}
      >
        <GuideStepDetails
          body={body}
          action={action}
          href={href}
          image={image}
          alt={alt}
        />
      </s-box>
    </s-box>
  );
}
