import type { SupportAuthor } from "~/db/schema";

/**
 * What a human is shown, in the order a queue cares about.
 *
 *   open     — waiting on US
 *   answered — waiting on the MERCHANT
 *   closed   — done
 */
export const SUPPORT_STATUSES = ["open", "answered", "closed"] as const;

export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

/**
 * The status of a thread, DERIVED rather than stored.
 *
 * A support thread has exactly one question — whose turn is it — and the
 * messages already answer it. Keeping a third `status` column in step with them
 * is the classic helpdesk defect: a thread that shows a reply and still reads
 * "open". So nothing writes a status; this reads the two facts that every
 * message write already sets.
 *
 * Pure, so the whole truth table is cheap to test and there is no branch that
 * only production can reach.
 */
export function statusOf(ticket: {
  readonly lastAuthor: SupportAuthor;
  readonly closedAt: number | null;
}): SupportStatus {
  // `!== null`, never a truthiness check: epoch 0 is a real closing time.
  if (ticket.closedAt !== null) return "closed";
  return ticket.lastAuthor === "merchant" ? "open" : "answered";
}

/**
 * Whether a side has unseen messages.
 *
 * Compared as timestamps rather than tracked as a flag, so it cannot fall out
 * of step with the thread. Equal timestamps count as READ — the alternative
 * leaves a thread permanently unread whenever a read receipt lands in the same
 * millisecond as the message it acknowledges.
 */
export function isUnreadFor(times: {
  readonly lastMessageAt: number;
  readonly lastReadAt: number | null;
}): boolean {
  if (times.lastReadAt === null) return true;
  return times.lastMessageAt > times.lastReadAt;
}
