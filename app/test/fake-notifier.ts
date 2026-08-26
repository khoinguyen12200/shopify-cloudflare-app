import type { Notifier, NotifyRequest } from "~/ports/notifier";

/**
 * A `Notifier` that sends nothing and remembers everything.
 *
 * The fake sits at the PORT, which is the outermost boundary for this effect —
 * not over a model, and not asserting on our own internals. An email leaves no
 * database state behind, so recording the request is the only honest way to
 * prove a use case asked for the right notification, to the right people, with
 * the right copy list.
 */
export interface FakeNotifier extends Notifier {
  readonly sent: NotifyRequest[];
  /** Every request for one event, in the order they were made. */
  forEvent(event: string): NotifyRequest[];
  /** The single request for one event. Throws unless there is exactly one. */
  onlyFor(event: string): NotifyRequest;
}

export function fakeNotifier(): FakeNotifier {
  const sent: NotifyRequest[] = [];

  const forEvent = (event: string) => sent.filter((request) => request.event === event);

  return {
    sent,
    forEvent,
    onlyFor(event) {
      const matches = forEvent(event);
      if (matches.length !== 1) {
        throw new Error(
          `expected exactly one ${event} notification, got ${matches.length}`,
        );
      }
      // Guaranteed by the length check above; read this way rather than with a
      // non-null assertion, which @rules/code-craft.md bans.
      const [only] = matches;
      if (!only) throw new Error("unreachable");
      return only;
    },
    async send(input) {
      sent.push(input);
      return undefined;
    },
  };
}
