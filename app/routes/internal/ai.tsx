import { aiRepository } from "~/wiring.server";
import { useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "AI Analytics · Staff Console" },
];
import { BlockStack, CardSkeleton, InlineStack, Page, StatCard } from "ngk-dashboard";
import { Coins, Gauge } from "lucide-react";
import { requireOwner } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { MODEL_ROLES, ROLE_LABEL, isModelRole } from "~/ai/roles";
import { findCatalogueModel } from "~/ai/catalogue";
import { recommendedChain } from "~/ai/ranking";
import { useActionToast } from "~/internal/use-action-toast";
import { formatNumber } from "~/i18n/format";
import type { Locale } from "~/i18n/config";
import { Deferred, StatRowSkeleton } from "~/internal/components";
import { streamRegion } from "~/internal/stream-region.server";
import { PurposeCard } from "./ai/purpose-card";
import { buildPurpose, summarizeRun } from "./ai/purposes";
import { RecentCallsCard } from "./ai/recent-calls-card";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function loadAiOverview() {
  const repo = aiRepository();
  const now = Date.now();

  const [rows, spend, runs] = await Promise.all([
    repo.allModels(),
    repo.tokensSince(now - THIRTY_DAYS_MS),
    repo.recentRuns(15),
  ]);

  return {
    purposes: MODEL_ROLES.map((role) => buildPurpose(role, rows, now)),
    spend,
    runs: runs.map(summarizeRun),
  };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only: changing a chain changes what every merchant is answered with,
  // and what we are billed. This is the ONLY thing awaited, so a non-owner still
  // gets the 403 before anything is rendered or any data query starts.
  await requireOwner(request, { users: adminUsers() });

  return { overview: streamRegion("ai", "overview", loadAiOverview()) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireOwner(request, { users: adminUsers() });
  const form = await request.formData();

  const role = String(form.get("role") ?? "");
  const intent = String(form.get("intent") ?? "");
  const modelId = String(form.get("modelId") ?? "");

  // Both sides narrowed by MEMBERSHIP, never cast: they arrive off a form, and
  // a model outside the catalogue resolves to nothing at call time — which
  // reads as a broken feature, not a bad setting (@rules/cloudflare.md).
  if (!isModelRole(role)) return { error: "That is not a purpose we use." as const };

  const repo = aiRepository();
  const at = Date.now();

  switch (intent) {
    case "add": {
      if (!findCatalogueModel(modelId)) {
        return { error: "That model is not in the catalogue." as const };
      }
      await repo.addToChain({ role, modelId, updatedBy: actor.email, at });
      return { success: `Added to ${ROLE_LABEL[role]}.` as const };
    }
    case "recommend": {
      // Seeds the top of this purpose's own ranking. An explicit button rather
      // than a silent default, so "no models" stays a real, choosable state and
      // what the runtime will actually use is always what the page shows.
      // Sequential on purpose: each append reads the chain's current max priority,
      // and the list is the fixed-length recommendation (CHAIN_LENGTH), staff-only.
      for (const id of recommendedChain(role)) {
        await repo.addToChain({ role, modelId: id, updatedBy: actor.email, at });
      }
      return { success: `${ROLE_LABEL[role]} set to the recommended chain.` as const };
    }
    case "remove":
      await repo.removeFromChain(role, modelId);
      return { success: `Removed from ${ROLE_LABEL[role]}.` as const };
    case "up":
    case "down":
      await repo.reorder({ role, modelId, direction: intent, at });
      return { success: `Reordered ${ROLE_LABEL[role]}.` as const };
    case "enable":
    case "disable":
      await repo.setEnabled({ role, modelId, enabled: intent === "enable", at });
      return { success: `Updated ${ROLE_LABEL[role]}.` as const };
    default:
      return { error: "Unknown action." as const };
  }
};

export default function AiSettings() {
  const { overview } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  useActionToast(actionData, {
    error: actionData && "error" in actionData ? actionData.error : undefined,
    success: actionData && "success" in actionData ? actionData.success : undefined,
  });

  return (
    <Page
      title="AI"
      subtitle="Which models do which job, in the order they are tried."
      fullWidth
    >
      <Deferred resolve={overview} fallback={<AiSkeleton />} errorTitle="AI settings">
        {({ purposes, spend, runs }) => (
          <BlockStack gap={4}>
            <UsageStats spend={spend} />
            {purposes.map((purpose) => (
              <PurposeCard key={purpose.role} purpose={purpose} busy={busy} />
            ))}
            <RecentCallsCard runs={runs} />
          </BlockStack>
        )}
      </Deferred>
    </Page>
  );
}

/** Mirrors the page: three usage tiles, one card per purpose, recent calls. */
function AiSkeleton() {
  return (
    <BlockStack gap={4}>
      <StatRowSkeleton count={3} />
      {MODEL_ROLES.map((role) => (
        <CardSkeleton key={role} lines={4} />
      ))}
      <CardSkeleton lines={5} />
    </BlockStack>
  );
}

function UsageStats({
  spend,
}: {
  spend: { calls: number; input: number; output: number };
}) {
  return (
    <InlineStack gap={4} className="flex-wrap [&>*]:min-w-48 [&>*]:flex-1">
      <StatCard label="Calls (30 days)" value={formatNumber(LOCALE, spend.calls)} icon={Gauge} />
      <StatCard label="Input tokens" value={formatNumber(LOCALE, spend.input)} icon={Coins} />
      <StatCard label="Output tokens" value={formatNumber(LOCALE, spend.output)} icon={Coins} />
    </InlineStack>
  );
}
