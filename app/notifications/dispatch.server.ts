import { NotificationLogRepo } from "~/models/notification-logs.server";
import { emailChannel } from "./channels/email/channel.server";
import type {
  Channel,
  EmailMessage,
  Message,
  NotificationEvent,
  Policy,
  SendContext,
  SendOutcome,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// ONE way to send a notification: dedupe → policy → reserve → send → settle.
//
// Every sender funnels through `dispatch`, so this is the single observability
// point (every attempt writes a row) and the single idempotency point. The
// alternative — a `sendEmail` here and a `sendSms` there — is two copies of the
// same five steps that drift apart, and a third channel is a third copy.
//
// The only per-channel differences live in REGISTRY. Adding a channel is one
// entry plus one `case`, and the compiler names the case you forgot.
// ─────────────────────────────────────────────────────────────────────────────

export interface DispatchMeta {
  event: NotificationEvent;
  /**
   * Set to make a retried job idempotent for this (event, recipient). Omit for
   * inherently-unique sends, where dedupe would swallow a legitimate second
   * message.
   */
  dedupeKey?: string;
  /** Optional tenant scope, recorded on the row. */
  shop?: string;
  /**
   * Pre-minted log id, for when the LINK INSIDE the message must contain it.
   * Otherwise dispatch mints one.
   */
  logId?: string;
}

export interface DispatchResult {
  outcome: SendOutcome;
  /** The row this attempt wrote. Absent when dedupe made it a no-op. */
  logId?: string;
  /** True when a prior queued/sent row short-circuited the send. */
  skipped: boolean;
}

/** What a channel needs registered alongside it. */
interface ChannelEntry<M extends Message> {
  channel: Channel<M>;
  /** Gates that run before the send. A channel with no policy simply has none. */
  policies?: Policy[];
}

/**
 * Keyed by the message discriminant. A missing or mismatched entry is a compile
 * error.
 */
const REGISTRY: { [K in Message["kind"]]: ChannelEntry<Extract<Message, { kind: K }>> } =
  {
    email: { channel: emailChannel },
  };

/** Applies one channel's policies and transport to a message of its own kind. */
type Handler = (message: Message, context: SendContext) => Promise<SendOutcome>;

/**
 * ONE HANDLER PER MESSAGE KIND — and this is where extensibility is enforced.
 *
 * The mapped key type is `Message["kind"]`, so adding `SmsMessage` to the union
 * makes THIS OBJECT stop compiling ("property 'sms' is missing") until a handler
 * exists. That is the exhaustiveness guarantee, checked by the compiler at the
 * place you would naturally look, rather than by a runtime `default` branch that
 * only fails once a customer is waiting for a message.
 *
 * Each handler re-checks its own discriminant instead of using a type
 * assertion. The check is trivially true — the key proves the kind — but it
 * costs nothing and keeps this file free of `as`, which @rules/code-craft.md
 * bans. A cast here is what the equivalent code in other codebases needs,
 * because TypeScript cannot correlate an index with a value that CONSUMES the
 * indexed type.
 */
const HANDLERS: { [K in Message["kind"]]: Handler } = {
  email: (message, context) =>
    message.kind === "email"
      ? runEntry(REGISTRY.email, message, context)
      : wrongKind(message),
};

/**
 * Reached only if a handler is wired to the wrong key — a coding mistake, not a
 * runtime condition.
 *
 * The parameter is `Message`, not `never`: TypeScript only narrows a discriminant
 * to `never` for a union with more than one member, so a `never` parameter would
 * not compile while there is a single channel. The compile-time guarantee lives
 * in HANDLERS' mapped key type, which is the stronger of the two anyway — it
 * catches a MISSING channel, where a `never` check only catches a misrouted one.
 */
function wrongKind(message: Message): Promise<SendOutcome> {
  return Promise.resolve({
    status: "failed",
    reason: "render_error",
    retriable: false,
    detail: `Channel handler received the wrong message kind: ${JSON.stringify(message)}`,
  });
}

/**
 * Thrown so a queue consumer retries with backoff.
 *
 * A transient failure MUST leave the handler as a throw. Returning a failure
 * lets the job complete successfully and the notification is gone for good.
 * Named so a deliberate retry is distinguishable from a genuine crash in logs.
 */
export class RetryableNotificationError extends Error {
  constructor(
    message: string,
    readonly logId: string,
  ) {
    super(message);
    this.name = "RetryableNotificationError";
  }
}

/**
 * Send one message, write exactly one row, and dedupe retries.
 *
 * Never throws for a PERMANENT failure — a notification that could not be sent
 * must not take down the request that triggered it, and the row is the record.
 * A RETRIABLE failure does throw, so a queue can try again.
 */
export async function dispatch(
  message: Message,
  meta: DispatchMeta,
  context: SendContext = {},
): Promise<DispatchResult> {
  const logs = new NotificationLogRepo();

  // Before anything else: has this already been handled? A skipped duplicate
  // must cost nothing, so this runs ahead of policies and transport.
  if (meta.dedupeKey) {
    const active = await logs.findActiveByDedupe(meta.dedupeKey, message.to);
    if (active) {
      return { outcome: { status: "sent" }, logId: active.id, skipped: true };
    }
  }

  const logId = meta.logId ?? crypto.randomUUID();
  const now = Date.now();

  await logs.reserve({
    id: logId,
    event: meta.event,
    channel: message.kind,
    recipient: message.to,
    dedupeKey: meta.dedupeKey,
    shop: meta.shop ?? context.shop,
    now,
  });

  const outcome = await run(message, context);

  await logs.settle(logId, {
    status: outcome.status,
    reasonCode: outcome.status === "sent" ? undefined : outcome.reason,
    detail: outcome.status === "sent" ? undefined : outcome.detail,
    providerStatus: outcome.status === "refused" ? undefined : outcome.providerStatus,
    providerMessageId:
      outcome.status === "sent" ? outcome.providerMessageId : undefined,
    now: Date.now(),
  });

  if (outcome.status === "failed" && outcome.retriable) {
    throw new RetryableNotificationError(
      `Retriable ${message.kind} failure for ${meta.event} → ${message.to}: ${outcome.reason}`,
      logId,
    );
  }

  return { outcome, logId, skipped: false };
}

/** Route the message to its channel. Nothing to change when one is added. */
function run(message: Message, context: SendContext): Promise<SendOutcome> {
  return HANDLERS[message.kind](message, context);
}

async function runEntry<M extends Message>(
  entry: ChannelEntry<M>,
  message: M,
  context: SendContext,
): Promise<SendOutcome> {
  // Policies run in order, and the FIRST refusal wins. Order is meaningful: a
  // recipient who has opted out should hear that, not "quota exceeded".
  for (const policy of entry.policies ?? []) {
    const refusal = await policy(context);
    if (refusal) {
      return { status: "refused", reason: refusal.reason, detail: refusal.detail };
    }
  }

  try {
    return await entry.channel.send(message, context);
  } catch (error) {
    // A transport that throws instead of returning a failure is still a failed
    // side effect and must leave the same record. Treated as retriable: the
    // realistic causes (reset connection, DNS, a 5xx surfaced as an exception)
    // are transient.
    return {
      status: "failed",
      reason: "transport_error",
      retriable: true,
      detail: error instanceof Error ? error.message : "transport threw",
    };
  }
}

/** Convenience for the common case. Kept thin — it only builds the message. */
export async function dispatchEmail(
  input: Omit<EmailMessage, "kind"> & DispatchMeta,
): Promise<DispatchResult> {
  const { event, dedupeKey, shop, logId, ...email } = input;
  return dispatch({ kind: "email", ...email }, { event, dedupeKey, shop, logId });
}
