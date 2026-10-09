import { Form } from "react-router";
import {
  Badge,
  BlockStack,
  Button,
  Card,
  CardContent,
  CardHeader,
  InlineStack,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from "ngk-dashboard";
import {
  ArrowDown,
  ArrowUp,
  Cpu,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  Wand2,
} from "lucide-react";
import { ChainButton } from "./chain-button";
import type { Purpose } from "./purposes";

type ChainEntry = Purpose["chain"][number];

function PurposeHeader({ purpose }: { purpose: Purpose }) {
  return (
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
  );
}

function EmptyChain({ role, busy }: { role: string; busy: boolean }) {
  return (
    <InlineStack gap={3} align="center" className="flex-wrap">
      <Text as="p" className="text-sm text-muted-foreground">
        No models yet — this purpose is switched off.
      </Text>
      <Form method="post">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="intent" value="recommend" />
        <Button type="submit" variant="outline" size="sm" disabled={busy}>
          <Wand2 className="mr-1 size-4" />
          Use recommended
        </Button>
      </Form>
    </InlineStack>
  );
}

function ChainEntryRow({
  role,
  entry,
  index,
  isLast,
  busy,
}: {
  role: string;
  entry: ChainEntry;
  index: number;
  isLast: boolean;
  busy: boolean;
}) {
  return (
    <InlineStack gap={2} align="center" className="rounded-md border px-3 py-2">
      <span className="w-6 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
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

      <ChainButton role={role} modelId={entry.modelId} intent="up" busy={busy} disabled={index === 0}>
        <ArrowUp className="size-4" />
      </ChainButton>
      <ChainButton role={role} modelId={entry.modelId} intent="down" busy={busy} disabled={isLast}>
        <ArrowDown className="size-4" />
      </ChainButton>
      <ChainButton
        role={role}
        modelId={entry.modelId}
        intent={entry.enabled ? "disable" : "enable"}
        busy={busy}
      >
        {entry.enabled ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}
      </ChainButton>
      <ChainButton role={role} modelId={entry.modelId} intent="remove" busy={busy}>
        <Trash2 className="size-4" />
      </ChainButton>
    </InlineStack>
  );
}

/**
 * The select is ordered FOR THIS PURPOSE — best first — so the default choice
 * is already the right one and nobody has to compare 21 model names.
 */
function AddModelForm({ purpose, busy }: { purpose: Purpose; busy: boolean }) {
  return (
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
  );
}

/**
 * One card per PURPOSE, each holding an ORDERED chain. The first model that
 * answers wins; a model that errors is tried past and demoted, so one flaky
 * model costs a retry rather than the feature.
 */
export function PurposeCard({ purpose, busy }: { purpose: Purpose; busy: boolean }) {
  return (
    <Card>
      <PurposeHeader purpose={purpose} />
      <CardContent>
        <BlockStack gap={3}>
          {purpose.chain.length === 0 ? (
            <EmptyChain role={purpose.role} busy={busy} />
          ) : (
            <BlockStack gap={2}>
              {purpose.chain.map((entry, index) => (
                <ChainEntryRow
                  key={entry.modelId}
                  role={purpose.role}
                  entry={entry}
                  index={index}
                  isLast={index === purpose.chain.length - 1}
                  busy={busy}
                />
              ))}
            </BlockStack>
          )}
          {purpose.available.length > 0 && <AddModelForm purpose={purpose} busy={busy} />}
        </BlockStack>
      </CardContent>
    </Card>
  );
}
