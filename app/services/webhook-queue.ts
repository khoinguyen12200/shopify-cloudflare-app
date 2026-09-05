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
  readonly outcome: "discarded" | "duplicate" | "processed" | "unavailable" | "failed" | "invalid" | "unsupported";
  readonly topic?: string;
  readonly handler?: string;
  readonly latencyMs?: number;
}

export interface QueueProcessingDependencies {
  readonly consume: (work: QueuedWebhook) => Promise<"processed" | "unavailable" | "missing" | "duplicate" | "unsupported" | { readonly outcome: "processed" | "unavailable" | "missing" | "duplicate" | "unsupported"; readonly topic: string | null }>;
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
    settleMessage(message, "ack");
    return;
  }
  const work = message.body;
  let result: Awaited<ReturnType<QueueProcessingDependencies["consume"]>>;
  try {
    result = await dependencies.consume({ ...work, attempts: message.attempts });
  } catch {
    await safeLog(dependencies.log, { event: "webhook.queue", id: work.id, shop: work.shop, attempts: message.attempts, outcome: "failed", latencyMs: (dependencies.now?.() ?? Date.now()) - started });
    settleMessage(message, "retry", work.id, message.attempts);
    return;
  }

  const outcome = typeof result === "string" ? result : result.outcome;
  const finalOutcome = outcome === "missing" ? "discarded" : outcome;
  const topic = typeof result === "string" ? undefined : result.topic ?? undefined;
  await safeLog(dependencies.log, { event: "webhook.queue", id: work.id, shop: work.shop, attempts: message.attempts, outcome: finalOutcome, topic, handler: topic, latencyMs: (dependencies.now?.() ?? Date.now()) - started });
  if (outcome === "unavailable") {
    settleMessage(message, "retry", work.id, message.attempts);
    return;
  }

  settleMessage(message, "ack", work.id, message.attempts);
}

async function safeLog(log: QueueProcessingDependencies["log"], entry: QueueLogEntry): Promise<void> {
  try {
    await log(entry);
  } catch (cause) {
    console.error(JSON.stringify({
      event: "webhook.queue_log_failed",
      ...(entry.id === undefined ? {} : { id: entry.id }),
      ...(entry.attempts === undefined ? {} : { attempts: entry.attempts }),
      error: errorMessage(cause),
    }));
  }
}

function settleMessage(
  message: QueueMessageLike,
  operation: "ack" | "retry",
  id?: string,
  attempts?: number,
): void {
  try {
    if (operation === "ack") message.ack();
    else message.retry();
  } catch (cause) {
    console.error(JSON.stringify({
      event: operation === "ack" ? "webhook.queue_ack_failed" : "webhook.queue_retry_failed",
      ...(id === undefined ? {} : { id }),
      ...(attempts === undefined ? {} : { attempts }),
      error: errorMessage(cause),
    }));
    throw cause;
  }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
