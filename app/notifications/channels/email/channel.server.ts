import { getEnv } from "~/request-context.server";
import type {
  Channel,
  EmailMessage,
  SendContext,
  SendOutcome,
} from "../../types";

/**
 * Email over the Cloudflare Email Sending binding.
 *
 * TRANSPORT ONLY. It does not log, dedupe, or check any policy — `dispatch`
 * owns those. Everything it knows how to do is "put this message on the wire, or
 * explain why it could not".
 *
 * Configuration per project:
 *   npx wrangler email sending enable yourdomain.com
 *   set EMAIL_FROM / EMAIL_FROM_NAME in wrangler.jsonc vars, per environment
 */
export class EmailChannel implements Channel<EmailMessage> {
  readonly key = "email" as const;

  // No constructor state: credentials come from the per-request env binding, so
  // a module-level instance must not read them at import time (there is no
  // request context then).

  async send(message: EmailMessage, _context: SendContext): Promise<SendOutcome> {
    const env = getEnv();

    // Cheapest checks first. A refusal costs nothing and must not pay for a
    // network round trip.
    const badAddress = refuseUnsendable(message.to);
    if (badAddress) return badAddress;

    if (!env.EMAIL || !env.EMAIL_FROM) {
      return {
        status: "refused",
        reason: "channel_not_configured",
        detail:
          "Email Sending is not set up. Onboard the domain with `wrangler email sending enable` and set EMAIL_FROM.",
      };
    }

    try {
      const response = await env.EMAIL.send({
        to: message.to,
        from: { email: env.EMAIL_FROM, name: env.EMAIL_FROM_NAME || env.EMAIL_FROM },
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(message.cc?.length ? { cc: message.cc } : {}),
      });

      return {
        status: "sent",
        providerMessageId: response.messageId,
        // Ours says the API accepted it. Nothing here claims delivery, because
        // the binding does not tell us — a provider callback would.
        providerStatus: "accepted",
      };
    } catch (error) {
      return classifyFailure(error);
    }
  }
}

/**
 * Addresses that can never receive mail.
 *
 * Refused before touching the API because a guaranteed hard bounce cannot
 * succeed, and every attempt burns quota and the sending domain's reputation for
 * real recipients. RFC 2606 reserves these names precisely so they never resolve.
 */
const RESERVED_DOMAINS = ["example.com", "example.net", "example.org"];
const RESERVED_TLDS = [".test", ".invalid", ".localhost", ".example"];

function refuseUnsendable(to: string): SendOutcome | null {
  const address = to.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return {
      status: "refused",
      reason: "recipient_undeliverable",
      detail: `${to} is not a usable email address`,
    };
  }

  const domain = address.slice(address.indexOf("@") + 1);
  if (
    RESERVED_DOMAINS.includes(domain) ||
    RESERVED_TLDS.some((tld) => domain.endsWith(tld))
  ) {
    return {
      status: "refused",
      reason: "recipient_undeliverable",
      detail: `${to} is a reserved address that can never receive mail`,
    };
  }

  return null;
}

/**
 * Is this failure worth another attempt?
 *
 * The distinction is the whole point. A retriable failure that is not retried
 * silently loses the message; a permanent failure that IS retried burns the
 * queue's attempts and writes the same useless row repeatedly.
 */
function classifyFailure(error: unknown): SendOutcome {
  const detail = error instanceof Error ? error.message : String(error);
  const haystack = detail.toLowerCase();

  // A suppressed or bouncing recipient will never start working.
  if (haystack.includes("suppress") || haystack.includes("bounce")) {
    return { status: "failed", reason: "rejected", retriable: false, detail };
  }
  if (haystack.includes("rate") || haystack.includes("429") || haystack.includes("throttl")) {
    return { status: "failed", reason: "throttled", retriable: true, detail };
  }
  // Anything else — 5xx, reset connection, DNS, a transport that threw — is
  // treated as transient. Getting this wrong the safe way means one extra
  // attempt, not a lost message.
  return { status: "failed", reason: "transport_error", retriable: true, detail };
}

export const emailChannel = new EmailChannel();
