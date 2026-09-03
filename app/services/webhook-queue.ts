import { isQueuedWebhook, type QueuedWebhook } from "~/ports/webhook-queue";

export interface QueueMessageLike {
  readonly body: unknown;
  readonly attempts: number;
  readonly ack: () => void;
  readonly retry: () => void;
}

export interface QueueBatchLike {
  readonly messages: readonly QueueMessageLike[];
}

export interface QueueLogEntry {
  readonly event: "webhook.queue";
  readonly id?: string;
  readonly shop?: string;
  readonly attempts?: number;
  readonly outcome: "discarded" | "duplicate" | "processed" | "unavailable" | "failed" | "invalid";
  readonly topic?: string;
  readonly handler?: string;
  readonly latencyMs?: number;
}

export interface QueueProcessingDependencies {
  readonly consume: (work: QueuedWebhook) => Promise<"processed" | "unavailable" | "missing" | "duplicate" | { readonly outcome: "processed" | "unavailable" | "missing" | "duplicate"; readonly topic: string | null }>;
  readonly log: (entry: QueueLogEntry) => void | Promise<void>;
  readonly now?: () => number;
}

export async function handleWebhookQueueBatch(
  batch: QueueBatchLike,
  dependencies: QueueProcessingDependencies,
): Promise<void> {
  for (const message of batch.messages) {
    await processQueuedWebhookMessage(message, dependencies);
  }
}

export async function processQueuedWebhookMessage(
  message: QueueMessageLike,
  dependencies: QueueProcessingDependencies,
): Promise<void> {
  const started = dependencies.now?.() ?? Date.now();
  if (!isQueuedWebhook(message.body)) {
    await safeLog(dependencies.log, { event: "webhook.queue", outcome: "invalid" });
    message.ack();
    return;
  }
  const work = message.body;
  try {
    const result = await dependencies.consume({ ...work, attempts: message.attempts });
    const outcome = typeof result === "string" ? result : result.outcome;
    const finalOutcome = outcome === "missing" ? "discarded" : outcome;
    const topic = typeof result === "string" ? undefined : result.topic ?? undefined;
    await safeLog(dependencies.log, { event: "webhook.queue", id: work.id, shop: work.shop, attempts: message.attempts, outcome: finalOutcome, topic, handler: topic, latencyMs: (dependencies.now?.() ?? Date.now()) - started });
    if (outcome === "unavailable") message.retry();
    else message.ack();
  } catch {
    await safeLog(dependencies.log, { event: "webhook.queue", id: work.id, shop: work.shop, attempts: message.attempts, outcome: "failed", latencyMs: (dependencies.now?.() ?? Date.now()) - started });
    message.retry();
  }
}

async function safeLog(log: QueueProcessingDependencies["log"], entry: QueueLogEntry): Promise<void> {
  try {
    await log(entry);
  } catch {
    // Observability failure must not alter queue delivery semantics.
  }
}
