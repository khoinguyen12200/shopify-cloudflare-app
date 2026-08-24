import {
  GLOBAL_SCOPE,
  NotificationSettingsRepo,
} from "~/models/notification-settings.server";
import { getEnv } from "~/request-context.server";
import type { ChannelKey, NotificationEvent } from "../types";
import type { EligibilityContext } from "./types";

/**
 * PATTERN: Imperative Shell around a Functional Core.
 *
 * This is the ONLY part of the gating layer that does I/O. It gathers every fact
 * the pure rules need, once, and hands them over as a plain object. The rules
 * themselves (`rules.ts`) never query anything.
 *
 * That split is what makes the interesting half testable with no database, and it
 * keeps the number of queries per decision fixed no matter how many rules exist.
 */

/**
 * Which channels the app can send on right now.
 *
 * A CAPABILITY, not a preference: it asks whether a transport is actually usable,
 * so a channel whose binding is missing is reported as unavailable rather than
 * failing later with a worse message.
 *
 * Extend this as channels arrive — an SMS entry would check for the provider
 * credentials the same way.
 */
export function availableChannels(): ChannelKey[] {
  const env = getEnv();
  const channels: ChannelKey[] = [];
  if (env.EMAIL && env.EMAIL_FROM) channels.push("email");
  return channels;
}

/** Gather the facts. One query for preferences, one for opt-outs. */
export async function loadEligibilityContext(input: {
  event: NotificationEvent;
  /** Addresses held for this recipient, per channel. */
  addresses: Partial<Record<ChannelKey, string>>;
  /** Tenant scope. Defaults to the app-wide scope. */
  scope?: string;
}): Promise<EligibilityContext> {
  const scope = input.scope ?? GLOBAL_SCOPE;
  const settings = new NotificationSettingsRepo();

  const [selection, optedOut] = await Promise.all([
    settings.selection(scope),
    settings.optedOutChannels(scope, input.addresses),
  ]);

  return {
    event: input.event,
    availableChannels: availableChannels(),
    selection,
    addresses: input.addresses,
    optedOut,
  };
}
