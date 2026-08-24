import { buildEmail, type EmailPropsByEvent } from "~/emails/registry.server";
import { dispatch, type DispatchResult } from "./dispatch.server";
import { resolveEligibility } from "./eligibility/resolve";
import { loadEligibilityContext } from "./eligibility/snapshot.server";
import type { ChannelDecision } from "./eligibility/types";
import type { ChannelKey, NotificationEvent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// THE ONE ENTRY POINT. Call sites use `notify()` and nothing else.
//
// It does four things, in order:
//   1. resolve the eligibility snapshot (one round of I/O)
//   2. decide, purely, which channels may carry this event to this recipient
//   3. render each allowed channel through its registered template
//   4. hand each message to `dispatch`, which logs and dedupes
//
// A caller never touches a channel, a template, a preference or the log. That is
// the property worth protecting: there is no way to send something that leaves no
// record, and no way to bypass a recipient's opt-out by reaching for a lower-level
// function, because the lower-level functions are not the ones you would find.
// ─────────────────────────────────────────────────────────────────────────────

export interface NotifyInput<E extends NotificationEvent> {
  event: E;
  /**
   * Where to reach the recipient, per channel. Email only, today. A channel with
   * no address here is refused as `recipient_unreachable` rather than attempted.
   */
  to: Partial<Record<ChannelKey, string>>;
  payload: EmailPropsByEvent[E];
  /** Tenant scope for preferences and opt-outs. Defaults to app-wide. */
  scope?: string;
  /** Idempotency key for (event, recipient). Omit for inherently-unique sends. */
  dedupeKey?: string;
  /** Pre-minted log id, for when the link inside the message must contain it. */
  logId?: string;
}

export interface NotifyResult {
  event: NotificationEvent;
  /** One per channel actually attempted. */
  dispatched: DispatchResult[];
  /**
   * Every channel considered, with its verdict.
   *
   * Returned even for the allowed ones, because "why didn't they get the text?"
   * is the most common question this system will ever be asked, and a function
   * that only reports what it DID send cannot answer it.
   */
  decisions: ChannelDecision[];
}

export async function notify<E extends NotificationEvent>(
  input: NotifyInput<E>,
): Promise<NotifyResult> {
  const context = await loadEligibilityContext({
    event: input.event,
    addresses: input.to,
    scope: input.scope,
  });

  const eligibility = resolveEligibility(context);

  // A refusal is logged, not silently dropped. Otherwise a suppressed
  // notification is indistinguishable from one that was never requested — and
  // that is exactly the case someone will be asked to explain.
  for (const decision of eligibility.decisions) {
    if (decision.allowed) continue;
    console.log(
      JSON.stringify({
        event: "notification.blocked",
        notification: input.event,
        channel: decision.channel,
        reason: decision.reason,
      }),
    );
  }

  const dispatched: DispatchResult[] = [];

  for (const channel of eligibility.allowed) {
    // The address is guaranteed present: `recipientReachable` refused otherwise.
    const to = input.to[channel];
    if (!to) continue;

    if (channel === "email") {
      const rendered = await buildEmail(input.event, input.payload);
      dispatched.push(
        await dispatch(
          {
            kind: "email",
            to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          },
          {
            event: input.event,
            dedupeKey: input.dedupeKey,
            shop: input.scope,
            logId: input.logId,
          },
        ),
      );
    }
  }

  return {
    event: input.event,
    dispatched,
    decisions: eligibility.decisions,
  };
}
