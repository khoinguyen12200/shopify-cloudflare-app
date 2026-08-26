import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  CardContent,
  CardHeader,
  InlineStack,
  Page,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Text,
} from "ngk-dashboard";
import { Coins, Cpu, Gauge } from "lucide-react";
import { requireOwner } from "~/services/admin-auth.server";
import { AiRepo } from "~/models/ai.server";
import { MODEL_ROLES, ROLE_DESCRIPTION, ROLE_LABEL, isModelRole } from "~/ai/roles";
import { WORKERS_AI_MODELS, findCatalogueModel } from "~/ai/catalogue";
import { useActionToast } from "~/internal/use-action-toast";
import { formatNumber } from "~/i18n/format";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only: changing the model changes what every merchant is answered
  // with, and what we are billed.
  await requireOwner(request);
  const repo = new AiRepo();

  const [chosen, spend, runs] = await Promise.all([
    repo.allModels(),
    repo.tokensSince(Date.now() - THIRTY_DAYS_MS),
    repo.recentRuns(15),
  ]);

  const byRole = new Map(chosen.map((row) => [row.role, row.modelId]));

  return {
    roles: MODEL_ROLES.map((role) => {
      const modelId = byRole.get(role) ?? null;
      return {
        role,
        label: ROLE_LABEL[role],
        description: ROLE_DESCRIPTION[role],
        modelId,
        // A model chosen before Cloudflare retired it still WORKS, but the
        // console should say so rather than showing it as an ordinary choice.
        retired: modelId !== null && findCatalogueModel(modelId) === undefined,
      };
    }),
    spend,
    runs: runs.map((run) => ({
      id: run.id,
      role: run.role,
      feature: run.feature,
      modelId: run.modelId,
      status: run.status,
      reasonCode: run.reasonCode,
      tokens: (run.inputTokens ?? 0) + (run.outputTokens ?? 0),
      latencyMs: run.latencyMs,
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const actor = await requireOwner(request);
  const form = await request.formData();

  const role = String(form.get("role") ?? "");
  const modelId = String(form.get("modelId") ?? "");

  // Both sides narrowed by MEMBERSHIP, never cast: the role and the model id
  // both arrive off a form, and a model that is not in the catalogue resolves
  // to nothing at call time — which reads as a broken feature, not a bad
  // setting (@rules/cloudflare.md).
  if (!isModelRole(role)) return { error: "That is not a role we use." as const };

  const repo = new AiRepo();

  if (modelId === "") {
    await repo.clearModel(role);
    return { success: `${ROLE_LABEL[role]} is now switched off.` as const };
  }

  if (!findCatalogueModel(modelId)) {
    return { error: "That model is not in the catalogue." as const };
  }

  await repo.setModel({ role, modelId, updatedBy: actor.email, at: Date.now() });
  return { success: `${ROLE_LABEL[role]} now uses ${modelId}.` as const };
};

export default function AiSettings() {
  const { roles, spend, runs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const pendingRole = navigation.formData?.get("role");

  useActionToast(actionData, {
    error: actionData && "error" in actionData ? actionData.error : undefined,
    success: actionData && "success" in actionData ? actionData.success : undefined,
  });

  return (
    <Page
      title="AI"
      subtitle="Which model does which job, and what it has cost."
      fullWidth
    >
      <BlockStack gap={4}>
        <InlineStack gap={4} className="flex-wrap [&>*]:min-w-48 [&>*]:flex-1">
          <StatCard label="Calls (30 days)" value={formatNumber(LOCALE, spend.calls)} icon={Gauge} />
          <StatCard label="Input tokens" value={formatNumber(LOCALE, spend.input)} icon={Coins} />
          <StatCard label="Output tokens" value={formatNumber(LOCALE, spend.output)} icon={Coins} />
        </InlineStack>

        {/*
          One card per PURPOSE, not per feature. A role is what a model must be
          good at; features pick a role, so this stays two cards however many
          AI surfaces arrive.
        */}
        {roles.map((entry) => (
          <Card key={entry.role}>
            <CardHeader>
              <InlineStack align="start" justify="between" gap={4}>
                <BlockStack gap={1}>
                  <InlineStack gap={2} align="center">
                    <Cpu className="size-4 text-muted-foreground" />
                    <Text as="h2" className="font-semibold">
                      {entry.label}
                    </Text>
                    {entry.modelId === null && <Badge variant="outline">Off</Badge>}
                    {entry.retired && <Badge variant="destructive">Not in catalogue</Badge>}
                  </InlineStack>
                  <Text as="p" className="text-sm text-muted-foreground">
                    {entry.description}
                  </Text>
                </BlockStack>
              </InlineStack>
            </CardHeader>
            <CardContent>
              <Form method="post" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="role" value={entry.role} />

                {/*
                  A SELECT, never a text field. A typo'd or retired id is
                  indistinguishable from a broken feature at call time, and the
                  catalogue is the only list that is true.
                */}
                <div className="min-w-72 flex-1">
                  <Text as="label" className="mb-1 block text-sm font-medium">
                    Model
                  </Text>
                  <Select name="modelId" defaultValue={entry.modelId ?? ""}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Off — no model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Off — no model</SelectItem>
                      {WORKERS_AI_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.label} — {contextLabel(model.contextWindow)}
                          {model.reasoning ? " · reasoning" : ""}
                          {model.toolCalling ? " · tools" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Text as="p" className="mt-1 block text-xs text-muted-foreground">
                    {entry.modelId ?? "Nothing is set — this purpose is switched off."}
                  </Text>
                </div>

                <Button type="submit" disabled={busy && pendingRole === entry.role}>
                  {busy && pendingRole === entry.role ? "Saving…" : "Save"}
                </Button>
              </Form>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <Text as="h2" className="font-semibold">
              Recent calls
            </Text>
            <Text as="p" className="text-sm text-muted-foreground">
              Every AI call leaves a row — including the ones that failed.
            </Text>
          </CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <Text as="p" className="text-sm text-muted-foreground">
                Nothing yet.
              </Text>
            ) : (
              <BlockStack gap={2}>
                {runs.map((run) => (
                  <InlineStack key={run.id} gap={3} align="center" className="text-sm">
                    <Badge variant={run.status === "ok" ? "outline" : "destructive"}>
                      {run.status === "ok" ? "ok" : (run.reasonCode ?? "error")}
                    </Badge>
                    <span className="font-medium">{run.feature}</span>
                    <span className="text-muted-foreground">{run.modelId}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      {formatNumber(LOCALE, run.tokens)} tok
                      {run.latencyMs === null ? "" : ` · ${formatNumber(LOCALE, run.latencyMs)} ms`}
                    </span>
                  </InlineStack>
                ))}
              </BlockStack>
            )}
          </CardContent>
        </Card>
      </BlockStack>
    </Page>
  );
}

function contextLabel(tokens: number): string {
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}k context` : `${tokens} context`;
}
