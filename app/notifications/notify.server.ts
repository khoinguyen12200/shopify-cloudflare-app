import { dispatch, type DispatchResult } from "./dispatch.server";
import { buildEmail, type EmailPropsByEvent } from "~/emails/registry.server";
import { supportsChannel } from "./catalogue";
import type { ChannelKey, NotificationEvent } from "./types";

/**
 * The ONE entry point callers use: `notify(event, recipient, payload)`.
 *
 * It renders through the event's registered template and hands the message to
 * `dispatch`, which logs and dedupes. A caller never touches a channel, a
 * template, or the log — so there is no way to send something that leaves no
 * record, which is the single most useful property of this whole design.
 */
export interface NotifyInput<E extends NotificationEvent> {
  event: E;
  to: string;
  payload: EmailPropsByEvent[E];
  /** Which channels to try. Defaults to every channel the event supports. */
  channels?: readonly ChannelKey[];
  /** Idempotency key for (event, recipient). Omit for inherently-unique sends. */
  dedupeKey?: string;
  shop?: string;
  /** Pre-minted log id, when the link inside the message must contain it. */
  logId?: string;
}

export async function notify<E extends NotificationEvent>(
  input: NotifyInput<E>,
): Promise<DispatchResult[]> {
  const channels = input.channels ?? ["email"];
  const results: DispatchResult[] = [];

  for (const channel of channels) {
    // A channel the event has no renderer for is skipped explicitly rather than
    // attempted and failing at render time.
    if (!supportsChannel(input.event, channel)) continue;

    if (channel === "email") {
      const rendered = await buildEmail(input.event, input.payload);
      results.push(
        await dispatch(
          {
            kind: "email",
            to: input.to,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          },
          {
            event: input.event,
            dedupeKey: input.dedupeKey,
            shop: input.shop,
            logId: input.logId,
          },
        ),
      );
    }
  }

  return results;
}
