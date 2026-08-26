/**
 * Who is actually copied on a notification, given who asked to be.
 *
 * PURE — no I/O, no clock. The opted-out set is resolved once by the caller and
 * handed in, the same shape as the eligibility layer next door.
 *
 * Three rules, and each exists because of a way a copy list goes wrong:
 *
 *   • The primary recipient is never also a copy. A merchant who types their
 *     own address into the copy list would otherwise get the same reply twice.
 *   • An address that has opted out is dropped. Consent is not a preference —
 *     someone who unsubscribed must not be reachable again through a colleague's
 *     ticket, which is a real way an unsubscribe gets quietly undone.
 *   • Addresses are normalised and deduped, so "Dev@Shop.test" and
 *     "dev@shop.test" are one person.
 *
 * Order is preserved, so the copy list reads the way the merchant built it.
 */
export function copyRecipients({
  cc,
  to,
  optedOut,
}: {
  readonly cc: readonly string[];
  /** The primary recipient — excluded from the result. */
  readonly to: string;
  /** Normalised addresses that have opted out of this channel. */
  readonly optedOut: ReadonlySet<string>;
}): string[] {
  const primary = normalise(to);
  const seen = new Set<string>();
  const out: string[] = [];

  for (const entry of cc) {
    const address = normalise(entry);
    if (address === "") continue;
    if (address === primary) continue;
    if (optedOut.has(address)) continue;
    if (seen.has(address)) continue;

    seen.add(address);
    out.push(address);
  }

  return out;
}

/** The one form an address is compared and stored in. */
function normalise(address: string): string {
  return address.trim().toLowerCase();
}
