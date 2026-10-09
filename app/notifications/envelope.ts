import { z } from "zod";
import { err, ok, type Result } from "~/lib/result";
import type { NotifyRequest } from "~/ports/notifier";
import type { PayloadByEvent } from "./payloads";
import type { NotificationEvent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// The QUEUE ENVELOPE: a notification request as it travels through a Cloudflare
// Queue. Pure — no I/O — so the consumer's edge can be tested with plain values.
//
// `payloads.ts` stays the single source of truth for what each event carries; the
// schemas below are CHECKED AGAINST those types (one direction), so a field added
// to a payload without its schema fails the build here rather than being
// stripped silently in transit.
// ─────────────────────────────────────────────────────────────────────────────

const basePayload = {
  recipientName: z.string(),
  locale: z.string().optional(),
  logoUrl: z.string().optional(),
};

const supportPayload = {
  ...basePayload,
  subject: z.string(),
  excerpt: z.string(),
  threadUrl: z.string(),
};

/**
 * One schema per event. Keyed by `NotificationEvent`, so a new event without a
 * schema stops compiling; `z.ZodType<PayloadByEvent[E]>` makes a schema that
 * drifts from its payload type a compile error as well.
 */
const PAYLOAD_SCHEMAS: { [E in NotificationEvent]: z.ZodType<PayloadByEvent[E]> } = {
  admin_password_reset: z.object({
    ...basePayload,
    resetUrl: z.string(),
    expiresIn: z.string(),
  }),
  support_merchant_activity: z.object({
    ...supportPayload,
    shopName: z.string(),
    isNew: z.boolean(),
  }),
  support_staff_reply: z.object({
    ...supportPayload,
    staffName: z.string(),
  }),
};

/** Keyed by the union, so the guard below cannot miss an event. */
const EVENT_KEYS: Record<NotificationEvent, true> = {
  admin_password_reset: true,
  support_merchant_activity: true,
  support_staff_reply: true,
};

/** Narrow a stored/queued string to a known event without a cast. */
export function isNotificationEvent(value: string): value is NotificationEvent {
  return Object.prototype.hasOwnProperty.call(EVENT_KEYS, value);
}

const ENVELOPE_VERSION = 1;

const addressSchema = z.string().min(1);

const envelopeSchema = z.object({
  v: z.literal(ENVELOPE_VERSION),
  event: z.string().refine(isNotificationEvent),
  to: z.object({ email: addressSchema.optional() }),
  cc: z.object({ email: z.array(addressSchema).optional() }).optional(),
  scope: z.string().min(1).optional(),
  // REQUIRED on the wire: a redelivery after a successful send must find the
  // first send's row and stop, which is only possible with a stable key.
  dedupeKey: z.string().min(1),
  logId: z.string().min(1).optional(),
  payload: z.unknown(),
});

/** A request that is safe to queue: it always carries a dedupe key. */
export type QueuedNotification = NotifyRequest & { readonly dedupeKey: string };

export type EnvelopeFailure = "malformed" | "unknown_event" | "invalid_payload";

/** The JSON-safe message body for one notification. */
export function toEnvelope(request: QueuedNotification) {
  return {
    v: ENVELOPE_VERSION,
    event: request.event,
    to: request.to,
    ...(request.cc === undefined ? {} : { cc: request.cc }),
    ...(request.scope === undefined ? {} : { scope: request.scope }),
    dedupeKey: request.dedupeKey,
    ...(request.logId === undefined ? {} : { logId: request.logId }),
    payload: request.payload,
  };
}

export type NotificationEnvelope = ReturnType<typeof toEnvelope>;

/**
 * Parse an untrusted queue body. Never throws: a body that cannot be understood
 * is an EXPECTED outcome the consumer acks and logs, because redelivering the
 * same bytes cannot make them valid.
 */
export function parseEnvelope(body: unknown): Result<QueuedNotification, EnvelopeFailure> {
  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) {
    const event = typeof body === "object" && body !== null && "event" in body ? body.event : undefined;
    const known = typeof event === "string" && isNotificationEvent(event);
    return err(known || event === undefined ? "malformed" : "unknown_event");
  }

  const { event } = envelope.data;
  if (!isNotificationEvent(event)) return err("unknown_event");

  const payload = PAYLOAD_SCHEMAS[event].safeParse(envelope.data.payload);
  if (!payload.success) return err("invalid_payload");

  return ok({
    event,
    to: envelope.data.to,
    ...(envelope.data.cc === undefined ? {} : { cc: envelope.data.cc }),
    ...(envelope.data.scope === undefined ? {} : { scope: envelope.data.scope }),
    dedupeKey: envelope.data.dedupeKey,
    ...(envelope.data.logId === undefined ? {} : { logId: envelope.data.logId }),
    payload: payload.data,
  });
}
