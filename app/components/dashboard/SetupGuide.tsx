import { useState } from "react";
import { useTranslation } from "react-i18next";

import { GuideStep } from "./GuideStep";

type ExpandedState = {
  guide: boolean;
  step1: boolean;
  step2: boolean;
  step3: boolean;
};

type Toggle = (key: keyof ExpandedState) => void;

function SetupGuideHeader({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  const { t } = useTranslation("admin");
  return (
    <s-grid gap="small-200">
      <s-grid gridTemplateColumns="1fr auto" gap="small-300" alignItems="center">
        <s-heading>{t("setupGuide.heading")}</s-heading>
        <s-button
          accessibilityLabel={t("setupGuide.toggleGuide")}
          variant="tertiary"
          tone="neutral"
          icon={expanded ? "chevron-up" : "chevron-down"}
          onClick={onToggle}
        ></s-button>
      </s-grid>
      <s-paragraph>{t("setupGuide.body")}</s-paragraph>
      <s-paragraph color="subdued">{t("setupGuide.progress")}</s-paragraph>
    </s-grid>
  );
}

function SetupGuideSteps({ expanded, toggle }: { expanded: ExpandedState; toggle: Toggle }) {
  const { t } = useTranslation("admin");
  return (
    <>
      <GuideStep
        title={t("setupGuide.steps.connect")}
        body={t("setupGuide.steps.connectBody")}
        action={t("setupGuide.steps.connectAction")}
        href="/admin/settings/general"
        image="/illustrations/onboarding.svg"
        alt={t("setupGuide.steps.connectAlt")}
        expanded={expanded.step1}
        onToggle={() => toggle("step1")}
        complete
        toggleLabel={t("setupGuide.toggleStep", { step: 1 })}
      />
      <s-divider></s-divider>
      <GuideStep
        title={t("setupGuide.steps.catalog")}
        body={t("setupGuide.steps.catalogBody")}
        action={t("setupGuide.steps.catalogAction")}
        href="/admin/products/new"
        image="/illustrations/catalog.svg"
        alt={t("setupGuide.steps.catalogAlt")}
        expanded={expanded.step2}
        onToggle={() => toggle("step2")}
        toggleLabel={t("setupGuide.toggleStep", { step: 2 })}
      />
      <s-divider></s-divider>
      <GuideStep
        title={t("setupGuide.steps.analytics")}
        body={t("setupGuide.steps.analyticsBody")}
        action={t("setupGuide.steps.analyticsAction")}
        href="/admin/analytics"
        image="/illustrations/analytics.svg"
        alt={t("setupGuide.steps.analyticsAlt")}
        expanded={expanded.step3}
        onToggle={() => toggle("step3")}
        toggleLabel={t("setupGuide.toggleStep", { step: 3 })}
      />
    </>
  );
}

/** An `s-section` (a direct child of `s-page` once rendered). */
export function SetupGuide() {
  const [expanded, setExpanded] = useState<ExpandedState>({
    guide: true,
    step1: true,
    step2: false,
    step3: false,
  });
  const toggle: Toggle = (key) =>
    setExpanded((current) => ({ ...current, [key]: !current[key] }));

  return (
    <s-section>
      <s-grid gap="base">
        <SetupGuideHeader expanded={expanded.guide} onToggle={() => toggle("guide")} />
        <s-box
          borderRadius="base"
          border="base"
          background="base"
          display={expanded.guide ? "auto" : "none"}
        >
          <SetupGuideSteps expanded={expanded} toggle={toggle} />
        </s-box>
      </s-grid>
    </s-section>
  );
}
