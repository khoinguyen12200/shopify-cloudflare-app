import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import {
  notificationLogs,
  type NotificationLog,
  type NotificationLogStatus,
} from "~/db/schema";

/** The ONLY place `notification_logs` is queried. */
export class NotificationLogRepo {
  /**
   * Reserve a row BEFORE the transport is called.
   *
   * Writing the row only after the transport answered means a crash in between
   * leaves a message the recipient DID receive with no row at all: invisible,
   * and re-sent by the next retry. Reserving first makes the gap visible as a
   * stuck `queued` row instead.
   */
  async reserve(input: {
    id: string;
    event: string;
    channel: string;
    recipient: string;
    dedupeKey?: string;
    shop?: string;
    now: number;
  }): Promise<void> {
    await getDb().insert(notificationLogs).values({
      id: input.id,
      event: input.event,
      channel: input.channel,
      recipient: input.recipient,
      status: "queued",
      dedupeKey: input.dedupeKey ?? null,
      shop: input.shop ?? null,
      createdAt: input.now,
      settledAt: null,
    });
  }

  /** Close out the reserved row with what actually happened. */
  async settle(
    id: string,
    input: {
      status: Exclude<NotificationLogStatus, "queued">;
      reasonCode?: string;
      detail?: string;
      providerStatus?: string;
      providerMessageId?: string;
      now: number;
    },
  ): Promise<void> {
    await getDb()
      .update(notificationLogs)
      .set({
        status: input.status,
        reasonCode: input.reasonCode ?? null,
        detail: input.detail ?? null,
        providerStatus: input.providerStatus ?? null,
        providerMessageId: input.providerMessageId ?? null,
        settledAt: input.now,
      })
      .where(eq(notificationLogs.id, id));
  }

  /**
   * Write one ALREADY-SETTLED row, for an outcome decided before any attempt.
   *
   * There is nothing in flight to reserve, so a reserve-then-settle pair would be
   * two writes describing one fact. Used by `notify` when the eligibility layer
   * refuses a channel — a suppressed notification has to be queryable, or
   * "why didn't they get it?" is answerable only from log lines nobody greps.
   */
  async recordSettled(input: {
    id: string;
    event: string;
    channel: string;
    recipient: string;
    status: Exclude<NotificationLogStatus, "queued">;
    reasonCode?: string;
    detail?: string;
    dedupeKey?: string;
    shop?: string;
    now: number;
  }): Promise<void> {
    await getDb().insert(notificationLogs).values({
      id: input.id,
      event: input.event,
      channel: input.channel,
      recipient: input.recipient,
      status: input.status,
      reasonCode: input.reasonCode ?? null,
      detail: input.detail ?? null,
      providerStatus: null,
      providerMessageId: null,
      dedupeKey: input.dedupeKey ?? null,
      shop: input.shop ?? null,
      createdAt: input.now,
      settledAt: input.now,
    });
  }

  /**
   * Is this (dedupeKey, recipient) already in flight or done?
   *
   * Matches `queued` as well as `sent`, so two workers cannot both notify while
   * neither has settled yet. A `failed` or `refused` row stays retryable — that
   * is the difference between "already handled" and "worth trying again".
   */
  async findActiveByDedupe(
    dedupeKey: string,
    recipient: string,
  ): Promise<NotificationLog | undefined> {
    const rows = await getDb()
      .select()
      .from(notificationLogs)
      .where(
        and(
          eq(notificationLogs.dedupeKey, dedupeKey),
          eq(notificationLogs.recipient, recipient),
          inArray(notificationLogs.status, ["queued", "sent"]),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Most recent attempts, newest first — for an internal history view. */
  async recent(limit = 50): Promise<NotificationLog[]> {
    return getDb()
      .select()
      .from(notificationLogs)
      .orderBy(desc(notificationLogs.createdAt))
      .limit(limit);
  }

  /** Prune old rows. Call from the cron; keep long enough to debug with. */
  async deleteOlderThan(cutoff: number): Promise<number> {
    const deleted = await getDb()
      .delete(notificationLogs)
      .where(lt(notificationLogs.createdAt, cutoff))
      .returning({ id: notificationLogs.id });
    return deleted.length;
  }
}
