import { and, eq, inArray } from "drizzle-orm";
import { notificationOptOuts, notificationPreferences } from "~/db/schema";
import { getDb } from "~/request-context.server";
import type { ChannelKey, NotificationEvent } from "~/notifications/types";

/** `"global"` is the app-wide scope; anything else is a tenant (a shop domain). */
export const GLOBAL_SCOPE = "global";

/** Normalise an address so an opt-out matches however it is later written. */
export function normalizeAddress(channel: ChannelKey, address: string): string {
  if (channel === "email") return address.trim().toLowerCase();
  return address.trim();
}

/**
 * The ONLY place `notification_preferences` and `notification_opt_outs` are
 * queried — the ADAPTER behind the port the eligibility layer depends on.
 */
export class NotificationSettingsRepo {
  /**
   * The tenant's channel selection, shaped for the eligibility snapshot.
   *
   * Tenant rows override global rows for the same (event, channel). An event with
   * NO rows at either scope is omitted entirely: absent means "no preference",
   * which is not the same as an empty selection.
   */
  async selection(
    scope: string,
  ): Promise<Partial<Record<NotificationEvent, ChannelKey[]>>> {
    const rows = await getDb()
      .select()
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.scope, [GLOBAL_SCOPE, scope]));

    // Tenant beats global for the same (event, channel).
    const merged = new Map<
      string,
      { event: string; channel: string; enabled: boolean }
    >();
    for (const row of rows) {
      const key = `${row.event}::${row.channel}`;
      const existing = merged.get(key);
      if (!existing || row.scope === scope) {
        merged.set(key, {
          event: row.event,
          channel: row.channel,
          enabled: row.enabled,
        });
      }
    }

    const selection: Partial<Record<NotificationEvent, ChannelKey[]>> = {};
    for (const { event, channel, enabled } of merged.values()) {
      const key = event as NotificationEvent;
      // Every event with any row gets an array — including an EMPTY one, which is
      // the explicit "none" the eligibility rules must be able to see.
      selection[key] ??= [];
      if (enabled) selection[key]!.push(channel as ChannelKey);
    }
    return selection;
  }

  /** Set one channel on or off for an event. */
  async setPreference(input: {
    scope: string;
    event: NotificationEvent;
    channel: ChannelKey;
    enabled: boolean;
    now: number;
  }): Promise<void> {
    await getDb()
      .insert(notificationPreferences)
      .values({
        scope: input.scope,
        event: input.event,
        channel: input.channel,
        enabled: input.enabled,
        updatedAt: input.now,
      })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.scope,
          notificationPreferences.event,
          notificationPreferences.channel,
        ],
        set: { enabled: input.enabled, updatedAt: input.now },
      });
  }

  /**
   * Back to "no preference" for an event, rather than storing every channel off.
   * Those are different states, and the difference is load-bearing.
   */
  async clearPreference(scope: string, event: NotificationEvent): Promise<void> {
    await getDb()
      .delete(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.scope, scope),
          eq(notificationPreferences.event, event),
        ),
      );
  }

  /** Channels this recipient has opted out of, at either scope. */
  async optedOutChannels(
    scope: string,
    addresses: Partial<Record<ChannelKey, string>>,
  ): Promise<ChannelKey[]> {
    const pairs = Object.entries(addresses).filter(
      (entry): entry is [ChannelKey, string] => Boolean(entry[1]),
    );
    if (pairs.length === 0) return [];

    const rows = await getDb()
      .select()
      .from(notificationOptOuts)
      .where(
        and(
          inArray(notificationOptOuts.scope, [GLOBAL_SCOPE, scope]),
          inArray(
            notificationOptOuts.address,
            pairs.map(([channel, address]) => normalizeAddress(channel, address)),
          ),
        ),
      );

    const out = new Set<ChannelKey>();
    for (const row of rows) {
      const match = pairs.find(
        ([channel, address]) =>
          channel === row.channel &&
          normalizeAddress(channel, address) === row.address,
      );
      if (match) out.add(match[0]);
    }
    return [...out];
  }

  /** Record an opt-out. Idempotent: a second STOP is not an error. */
  async optOut(input: {
    scope: string;
    channel: ChannelKey;
    address: string;
    source?: string;
    now: number;
  }): Promise<void> {
    await getDb()
      .insert(notificationOptOuts)
      .values({
        scope: input.scope,
        channel: input.channel,
        address: normalizeAddress(input.channel, input.address),
        optedOutAt: input.now,
        source: input.source ?? null,
      })
      .onConflictDoNothing();
  }

  /**
   * Undo an opt-out.
   *
   * Exposed because a recipient can re-subscribe, but note who may call it: only
   * the recipient's own action (a START text, clicking re-subscribe). Staff
   * clearing someone else's opt-out is what carriers and regulators penalise, so
   * no admin screen in this scaffold offers it.
   */
  async optIn(
    scope: string,
    channel: ChannelKey,
    address: string,
  ): Promise<void> {
    await getDb()
      .delete(notificationOptOuts)
      .where(
        and(
          eq(notificationOptOuts.scope, scope),
          eq(notificationOptOuts.channel, channel),
          eq(notificationOptOuts.address, normalizeAddress(channel, address)),
        ),
      );
  }
}
