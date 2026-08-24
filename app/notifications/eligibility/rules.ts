import { EVENTS } from "../catalogue";
import type { ChannelKey } from "../types";
import type { EligibilityContext, EligibilityRule } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN: Chain of Responsibility, built from a FUNCTIONAL CORE.
//
// Each rule answers exactly one question, purely, over the snapshot in
// `EligibilityContext`. `resolve.ts` runs them in a fixed order and stops at the
// first refusal.
//
// Why pure, and why a snapshot: rules that each do their own I/O turn one
// decision into N queries, cannot be tested without a database, and make the
// evaluation ORDER a performance question instead of a product one. Here the
// order is chosen for what the reader most needs to hear, and costs nothing.
//
// Adding a rule — quiet hours, rate caps, per-recipient digest windows — is one
// entry in `RULES` plus a `BlockReason`. Nothing else changes, and the union
// makes every reader of the reason handle it.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CAPABILITY. Can this channel send at all?
 *
 * Never bypassable: "essential" cannot conjure a transport that is not
 * configured, and pretending otherwise produces a send that fails later with a
 * worse message.
 */
const channelAvailable: EligibilityRule = {
  reason: "channel_unavailable",
  bypassableByEssential: false,
  permits: (channel, context) => {
    // The event must also HAVE a renderer for this channel. Asking a channel the
    // event cannot render is a silent no-send, so it is refused by name here.
    if (!EVENTS[context.event].channels.includes(channel)) return false;
    return context.availableChannels.includes(channel);
  },
};

/**
 * REACHABILITY. Do we hold an address for this recipient on this channel?
 *
 * Never bypassable, for the same reason as capability. Deliberately separate from
 * consent: "we have no phone number" and "they told us to stop" are different
 * facts and need different fixes, and collapsing them tells the wrong story to
 * whoever has to act on it.
 */
const recipientReachable: EligibilityRule = {
  reason: "recipient_unreachable",
  bypassableByEssential: false,
  permits: (channel, context) => {
    const address = context.addresses[channel];
    return typeof address === "string" && address.trim().length > 0;
  },
};

/**
 * CONSENT. Has the recipient opted out?
 *
 * **Never bypassable — this is the one rule that is a legal constraint rather
 * than a preference.** No setting, no "essential" flag and no resend button may
 * override it. If a message truly must reach someone who opted out of a channel,
 * that is a different channel's job, not an exemption here.
 */
const recipientConsents: EligibilityRule = {
  reason: "recipient_opted_out",
  bypassableByEssential: false,
  permits: (channel, context) => !context.optedOut.includes(channel),
};

/**
 * PREFERENCE. Has the tenant selected this channel for this event?
 *
 * The only bypassable rule: an `essential` event is one the recipient asked for,
 * so a tenant preference must not be able to suppress it.
 *
 * A SELECTION rather than a boolean, because "email on every status change but
 * SMS only when it is ready" is the normal shape of this requirement — and on a
 * metered channel it is also a cost decision.
 *
 * ABSENT is not EMPTY. No entry means "no preference", which falls back to the
 * event's declared channels. An empty array is an explicit "none": the tenant
 * turned everything off for this event, and that must be honoured rather than
 * read as unset.
 */
const tenantSelects: EligibilityRule = {
  reason: "not_selected",
  bypassableByEssential: true,
  permits: (channel, context) => {
    const selected = context.selection[context.event];
    if (selected === undefined) {
      // No preference → the event's own default.
      return EVENTS[context.event].channels.includes(channel);
    }
    return selected.includes(channel);
  },
};

/**
 * The chain, in the order the answer is most useful.
 *
 * Order is a product decision, not an optimisation. "SMS is not configured" is
 * actionable; "this event is not selected for SMS" is confusing to someone who
 * never set SMS up in the first place. So capability is reported first, and the
 * tenant's own choice last — by then everything that is not their choice has been
 * ruled out.
 */
export const RULES: readonly EligibilityRule[] = [
  channelAvailable,
  recipientReachable,
  recipientConsents,
  tenantSelects,
];

/** Channels worth asking about for an event — its declared set, deduped. */
export function candidateChannels(
  context: EligibilityContext,
): readonly ChannelKey[] {
  const declared = EVENTS[context.event].channels;
  const selected = context.selection[context.event];
  // Consider the union: a selection naming a channel the event cannot render
  // should be REFUSED BY NAME (`channel_unavailable`) rather than silently
  // dropped, so a stale setting is visible instead of invisible.
  return [...new Set([...declared, ...(selected ?? [])])];
}
