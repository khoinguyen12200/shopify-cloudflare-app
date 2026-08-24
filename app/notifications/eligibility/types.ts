import type { ChannelKey, NotificationEvent, RefusalReason } from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// Whether a notification MAY go out, on which channel, to whom.
//
// Four different questions get conflated into "is it enabled?", and they behave
// differently, so they are named separately here:
//
//   CAPABILITY  — can this channel send at all? (binding configured, plan allows)
//   REACHABILITY — do we have an address for this recipient on this channel?
//   CONSENT     — has the recipient said no? (legal; never overridable)
//   PREFERENCE  — has the tenant chosen this channel for this event? (a choice)
//
// The distinction that matters most: a PREFERENCE is a choice and an `essential`
// event may ignore it. CONSENT and CAPABILITY are not choices — no setting, no
// button, and no "essential" flag may override them. Encoding that as a boolean
// on each rule (below) is what stops the next person from adding a bypass to the
// wrong one.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a channel was not used.
 *
 * An ALIAS of `RefusalReason`, not a parallel set. The reason stored in
 * `notification_logs.reason_code`, the reason logged, and the reason shown to a
 * human are then one value — where two overlapping vocabularies drift apart and
 * nothing fails when they do.
 */
export type BlockReason = RefusalReason;

/** One channel's verdict. A union, so `reason` cannot be read on an allow. */
export type ChannelDecision =
  | { channel: ChannelKey; allowed: true }
  | { channel: ChannelKey; allowed: false; reason: BlockReason };

/** The whole answer for one (event, recipient). */
export interface Eligibility {
  event: NotificationEvent;
  /** Channels that may be used, in the order they were asked about. */
  allowed: ChannelKey[];
  /** Every channel considered, with its verdict — including the allowed ones. */
  decisions: ChannelDecision[];
}

/**
 * Everything the rules need, RESOLVED ONCE before any of them runs.
 *
 * The rules are pure functions over this snapshot. That is deliberate: policies
 * that each do their own I/O turn one decision into N queries, cannot be tested
 * without a database, and make the ORDER of evaluation a performance question
 * instead of a product one.
 */
export interface EligibilityContext {
  event: NotificationEvent;
  /**
   * Channels the app can actually send on right now — binding configured, plan
   * allows it. A CAPABILITY, not a preference.
   */
  availableChannels: readonly ChannelKey[];
  /**
   * The tenant's selection: event → the channels it should go out on.
   *
   * **Absent and empty mean different things.** Absent (no key) is "no
   * preference" and falls back to the event's default. Empty is an explicit
   * "none" — the tenant switched every channel off for this event.
   */
  selection: Partial<Record<NotificationEvent, readonly ChannelKey[]>>;
  /** Addresses held for this recipient, per channel. Missing = unreachable. */
  addresses: Partial<Record<ChannelKey, string>>;
  /** Channels this recipient has opted out of. */
  optedOut: readonly ChannelKey[];
}

/**
 * One question, answered purely.
 *
 * `bypassableByEssential` is the important field. An `essential` event — a
 * password reset, a receipt, a legal notice — may ignore a tenant's preference,
 * because the recipient asked for it. It may NOT ignore consent (illegal) or
 * capability (impossible). Marking that per rule means the exemption cannot be
 * applied to the wrong one by accident.
 */
export interface EligibilityRule {
  reason: BlockReason;
  bypassableByEssential: boolean;
  /** True = this rule permits the channel. */
  permits(channel: ChannelKey, context: EligibilityContext): boolean;
}
