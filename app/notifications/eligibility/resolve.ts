import { EVENTS } from "../catalogue";
import { RULES, candidateChannels } from "./rules";
import type {
  ChannelDecision,
  Eligibility,
  EligibilityContext,
} from "./types";

/**
 * Run the chain and produce the verdict for every candidate channel.
 *
 * PURE — no I/O, no clock, no env. Everything it needs is in `context`, resolved
 * once by the caller. That is what makes the whole gating layer testable with no
 * database and no network, which in turn is why it can afford to be exhaustive.
 *
 * The result records EVERY channel considered, allowed or not, with the reason.
 * Only returning the allowed set is what makes "why didn't they get the text?"
 * unanswerable — the most common question this system will ever be asked.
 */
export function resolveEligibility(context: EligibilityContext): Eligibility {
  // An `essential` event is one the recipient asked for — a password reset, a
  // receipt, a legal notice — so a tenant PREFERENCE must not suppress it.
  // Consent and capability are not preferences and are never skipped; see the
  // `bypassableByEssential` flag on each rule.
  const essential = EVENTS[context.event].gate === "essential";

  const decisions: ChannelDecision[] = candidateChannels(context).map((channel) => {
    for (const rule of RULES) {
      if (essential && rule.bypassableByEssential) continue;
      if (!rule.permits(channel, context)) {
        return { channel, allowed: false, reason: rule.reason };
      }
    }
    return { channel, allowed: true };
  });

  return {
    event: context.event,
    allowed: decisions.filter((d) => d.allowed).map((d) => d.channel),
    decisions,
  };
}

/** Why one channel was refused, or null when it was allowed. */
export function blockedReason(
  eligibility: Eligibility,
  channel: string,
): string | null {
  const decision = eligibility.decisions.find((d) => d.channel === channel);
  if (!decision || decision.allowed) return null;
  return decision.reason;
}
