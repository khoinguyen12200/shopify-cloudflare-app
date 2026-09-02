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
import {
  ArrowDown,
  ArrowUp,
  Coins,
  Cpu,
  Gauge,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { requireOwner } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { AiRepo } from "~/models/ai.server";
import {
  MODEL_ROLES,
  ROLES_IN_USE,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  isModelRole,
} from "~/ai/roles";
import { findCatalogueModel, type CatalogueModel } from "~/ai/catalogue";
import { rankModelsForRole, recommendedChain } from "~/ai/ranking";
import { isDemoted } from "~/ai/chain";
import { useActionToast } from "~/internal/use-action-toast";
import { formatNumber } from "~/i18n/format";
import type { Locale } from "~/i18n/config";

/** The internal console is staff-only and English-only — no i18n here. */
const LOCALE: Locale = "en";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // Owner-only: changing a chain changes what every merchant is answered with,
  // and what we are billed.
  await requireOwner(request, { users: adminUsers() });
  const repo = new AiRepo();
  const now = Date.now();

  const [rows, spend, runs] = await Promise.all([
    repo.allModels(),
    repo.tokensSince(now - THIRTY_DAYS_MS),
    repo.recentRuns(15),
  ]);

  return {
    purposes: MODEL_ROLES.map((role) => {
      const chain = rows.filter((row) => row.role === role);
      const chosen = new Set(chain.map((row) => row.modelId));

      return {
        role,
        label: ROLE_LABEL[role],
        description: ROLE_DESCRIPTION[role],
        usedBy: ROLES_IN_USE[role],
        chain: chain.map((row) => ({
          modelId: row.modelId,
          label: findCatalogueModel(row.modelId)?.label ?? row.modelId,
          enabled: row.enabled,
          // Demoted by the RUNTIME after a failure — not something an admin set.
          demoted: isDemoted(
            {
              modelId: row.modelId,
              priority: row.priority,
              enabled: row.enabled,
              healthy: row.healthy,
              lastFailedAt: row.lastFailedAt,
            },
            now,
          ),
          // A model chosen before Cloudflare retired it still WORKS; say so
          // rather than showing it as an ordinary choice.
          retired: findCatalogueModel(row.modelId) === undefined,
        })),
        // Ranked FOR THIS PURPOSE, best first, minus what is already in the
        // chain — so the top of the list is always the right next pick.
        available: rankModelsForRole(role)
          .filter((model) => !chosen.has(model.id))
          .map((model) => ({
            id: model.id,
            label: model.label,
            note: modelNote(model),
          })),
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

/** Everything a person needs to judge a model, from the catalogue's own facts. */
function modelNote(model: CatalogueModel): string {
  const parts = [
    `${Math.round(model.contextWindow / 1000)}k ctx`,
    `$${(model.outputMicroUsdPerMTokens / 1_000_000).toFixed(2)}/M out`,
  ];
  if (model.toolCalling) parts.push("tools");
  if (model.reasoning) parts.push("thinks aloud");
  return parts.join(" · ");
}

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

  const repo = new AiRepo();
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
  const { purposes, spend, runs } = useLoaderData<typeof loader>();
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
      <BlockStack gap={4}>
        <InlineStack gap={4} className="flex-wrap [&>*]:min-w-48 [&>*]:flex-1">
          <StatCard label="Calls (30 days)" value={formatNumber(LOCALE, spend.calls)} icon={Gauge} />
          <StatCard label="Input tokens" value={formatNumber(LOCALE, spend.input)} icon={Coins} />
          <StatCard label="Output tokens" value={formatNumber(LOCALE, spend.output)} icon={Coins} />
        </InlineStack>

        {/*
          One card per PURPOSE, each holding an ORDERED chain. The first model
          that answers wins; a model that errors is tried past and demoted, so
          one flaky model costs a retry rather than the feature.
        */}
        {purposes.map((purpose) => (
          <Card key={purpose.role}>
            <CardHeader>
              <BlockStack gap={1}>
                <InlineStack gap={2} align="center">
                  <Cpu className="size-4 text-muted-foreground" />
                  <Text as="h2" className="font-semibold">
                    {purpose.label}
                  </Text>
                  {purpose.usedBy ? (
                    <Badge variant="outline">{purpose.usedBy}</Badge>
                  ) : (
                    <Badge variant="secondary">Not used yet</Badge>
                  )}
                  {purpose.chain.length === 0 && <Badge variant="outline">Off</Badge>}
                </InlineStack>
                <Text as="p" className="text-sm text-muted-foreground">
                  {purpose.description}
                </Text>
              </BlockStack>
            </CardHeader>

            <CardContent>
              <BlockStack gap={3}>
                {purpose.chain.length === 0 ? (
                  <InlineStack gap={3} align="center" className="flex-wrap">
                    <Text as="p" className="text-sm text-muted-foreground">
                      No models yet — this purpose is switched off.
                    </Text>
                    <Form method="post">
                      <input type="hidden" name="role" value={purpose.role} />
                      <input type="hidden" name="intent" value="recommend" />
                      <Button type="submit" variant="outline" size="sm" disabled={busy}>
                        <Wand2 className="mr-1 size-4" />
                        Use recommended
                      </Button>
                    </Form>
                  </InlineStack>
                ) : (
                  <BlockStack gap={2}>
                    {purpose.chain.map((entry, index) => (
                      <InlineStack
                        key={entry.modelId}
                        gap={2}
                        align="center"
                        className="rounded-md border px-3 py-2"
                      >
                        <span className="w-6 text-sm tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <BlockStack gap={0} className="min-w-0 flex-1">
                          <Text as="span" className="truncate font-medium">
                            {entry.label}
                          </Text>
                          <Text as="span" className="truncate text-xs text-muted-foreground">
                            {entry.modelId}
                          </Text>
                        </BlockStack>

                        {!entry.enabled && <Badge variant="secondary">Paused</Badge>}
                        {/* Set by the RUNTIME after a failure, and it clears itself. */}
                        {entry.demoted && <Badge variant="destructive">Recently failed</Badge>}
                        {entry.retired && <Badge variant="destructive">Not in catalogue</Badge>}

                        <ChainButton role={purpose.role} modelId={entry.modelId} intent="up" busy={busy} disabled={index === 0}>
                          <ArrowUp className="size-4" />
                        </ChainButton>
                        <ChainButton role={purpose.role} modelId={entry.modelId} intent="down" busy={busy} disabled={index === purpose.chain.length - 1}>
                          <ArrowDown className="size-4" />
                        </ChainButton>
                        <ChainButton
                          role={purpose.role}
                          modelId={entry.modelId}
                          intent={entry.enabled ? "disable" : "enable"}
                          busy={busy}
                        >
                          {entry.enabled ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
                        </ChainButton>
                        <ChainButton role={purpose.role} modelId={entry.modelId} intent="remove" busy={busy}>
                          <Trash2 className="size-4" />
                        </ChainButton>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}

                {/*
                  The select is ordered FOR THIS PURPOSE — best first — so the
                  default choice is already the right one and nobody has to
                  compare 21 model names.
                */}
                {purpose.available.length > 0 && (
                  <Form method="post" className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="role" value={purpose.role} />
                    <input type="hidden" name="intent" value="add" />
                    <div className="min-w-80 flex-1">
                      <Select name="modelId" defaultValue={purpose.available[0]?.id}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose a model…" />
                        </SelectTrigger>
                        <SelectContent>
                          {purpose.available.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.label} — {model.note}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" variant="outline" disabled={busy}>
                      <Plus className="mr-1 size-4" />
                      Add to chain
                    </Button>
                  </Form>
                )}
              </BlockStack>
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <Text as="h2" className="font-semibold">
              Recent calls
            </Text>
            <Text as="p" className="text-sm text-muted-foreground">
              Every attempt leaves a row — including the ones that failed and fell through.
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
                    <span className="truncate text-muted-foreground">{run.modelId}</span>
                    <span className="ml-auto whitespace-nowrap tabular-nums text-muted-foreground">
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

/** One icon button that posts a single chain intent. */
function ChainButton({
  role,
  modelId,
  intent,
  busy,
  disabled,
  children,
}: {
  role: string;
  modelId: string;
  intent: "up" | "down" | "remove" | "enable" | "disable";
  busy: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Form method="post">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="intent" value={intent} />
      <Button type="submit" variant="ghost" size="sm" disabled={busy || disabled}>
        {children}
      </Button>
    </Form>
  );
}
