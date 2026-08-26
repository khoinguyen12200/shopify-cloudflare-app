import { composeEmailMessage } from "./channels/email/compose";
import { NotificationLogRepo } from "~/models/notification-logs.server";
import {
  GLOBAL_SCOPE,
  NotificationSettingsRepo,
} from "~/models/notification-settings.server";
import { copyRecipients } from "./copy-recipients";
import type { NotifyRequest } from "~/ports/notifier";
import { dispatch, type DispatchResult } from "./dispatch.server";
import { resolveEligibility } from "./eligibility/resolve";
import { loadEligibilityContext } from "./eligibility/snapshot.server";
import type { ChannelDecision } from "./eligibility/types";
import type { PayloadByEvent } from "./payloads";
import type { ChannelKey, Message, NotificationEvent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE ENTRY POINT. Call sites use `notify()` and nothing else.
//
// It does four things, in order:
//   1. resolve the eligibility snapshot (one round of I/O)
//   2. decide, purely, which channels may carry this event to this recipient
//   3. compose a Message for each allowed channel, from its registered template
//   4. hand each Message to `dispatch`, which logs and dedupes
//
// A caller never touches a channel, a template, a preference or the log. That is
// the property worth protecting: there is no way to send something that leaves no
// record, and no way to bypass a recipient's opt-out by reaching for a
// lower-level function.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Turns an event + payload into a Message for ONE channel.
 *
 * A method with its own type parameter, not a plain function type, so the
 * event/payload correlation survives into each composer — the builder receives
 * exactly its own event's payload rather than a union of every payload.
 */
interface Composer {
  compose<E extends NotificationEvent>(
    event: E,
    payload: PayloadByEvent[E],
    to: string,
    /**
     * Addresses to copy, already filtered. A channel with no notion of copies
     * simply ignores it — which is why it is a parameter here rather than a
     * field every Message kind has to carry.
     */
    cc: readonly string[],
  ): Promise<Message>;
}

/**
 * ONE COMPOSER PER CHANNEL, and this is the seam that keeps `notify` closed.
 *
 * Keyed `[K in Message["kind"]]`, so adding `SmsMessage` to the union makes this
 * object stop compiling until a composer exists — the same guarantee `HANDLERS`
 * gives `dispatch`. The loop below then needs no `if (channel === …)` branch, so
 * the only thing a new channel touches is this table.
 */
const COMPOSERS: { [K in Message["kind"]]: Composer } = {
  email: { compose: composeEmailMessage },
};

export interface NotifyResult {
  event: NotificationEvent;
  /** One per channel actually attempted. */
  dispatched: DispatchResult[];
  /**
   * Every channel considered, with its verdict.
   *
   * Returned even for the allowed ones, because "why didn't they get it?" is the
   * question this system will be asked most, and a function that only reports
   * what it DID send cannot answer it.
   */
  decisions: ChannelDecision[];
}

export async function notify<E extends NotificationEvent>(
  input: NotifyRequest<E>,
): Promise<NotifyResult> {
  const context = await loadEligibilityContext({
    event: input.event,
    addresses: input.to,
    scope: input.scope,
  });

  const eligibility = resolveEligibility(context);

  // A refusal gets its own `refused` ROW, not just a log line.
  //
  // This is the record that answers "why didn't they get it?". A console line is
  // not that: it is unqueryable, it ages out, and it leaves a suppressed
  // notification indistinguishable from one that was never requested. The status
  // is `refused` rather than `failed` because nothing was attempted.
  const logs = new NotificationLogRepo();
  const now = Date.now();

  for (const decision of eligibility.decisions) {
    if (decision.allowed) continue;
    await logs.recordSettled({
      id: crypto.randomUUID(),
      event: input.event,
      channel: decision.channel,
      // The address may legitimately be absent — that IS the refusal in the
      // `recipient_unreachable` case — so record what was asked for.
      recipient: input.to[decision.channel] ?? "(none)",
      status: "refused",
      reasonCode: decision.reason,
      dedupeKey: input.dedupeKey,
      shop: input.scope,
      now,
    });
  }

  const dispatched: DispatchResult[] = [];

  for (const channel of eligibility.allowed) {
    // Guaranteed present: `recipientReachable` refused the channel otherwise.
    const to = input.to[channel];
    if (!to) continue;

    const message = await COMPOSERS[channel].compose(
      input.event,
      input.payload,
      to,
      await allowedCopies({
        cc: input.cc?.[channel] ?? [],
        to,
        channel,
        scope: input.scope,
      }),
    );

    dispatched.push(
      await dispatch(message, {
        event: input.event,
        dedupeKey: input.dedupeKey,
        shop: input.scope,
        logId: input.logId,
      }),
    );
  }

  return {
    event: input.event,
    dispatched,
    decisions: eligibility.decisions,
  };
}

/**
 * The copy list for one channel, with opted-out addresses removed.
 *
 * The opt-out lookup is skipped entirely when nobody was copied, so the common
 * case — every notification that has no copy list — costs no extra query.
 */
async function allowedCopies(input: {
  cc: readonly string[];
  to: string;
  channel: ChannelKey;
  scope?: string;
}): Promise<readonly string[]> {
  if (input.cc.length === 0) return [];

  const optedOut = await new NotificationSettingsRepo().optedOutAddresses(
    input.scope ?? GLOBAL_SCOPE,
    input.channel,
    input.cc,
  );

  return copyRecipients({ cc: input.cc, to: input.to, optedOut });
}
