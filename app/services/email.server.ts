import { getEnv } from "~/request-context.server";

/**
 * Transactional email via the Cloudflare Email Sending binding.
 *
 * SETUP PER PROJECT (the binding does nothing until this is done):
 *   1. npx wrangler email sending enable yourdomain.com
 *   2. Set EMAIL_FROM (an address on that domain) and EMAIL_FROM_NAME in
 *      wrangler.jsonc vars, per environment.
 *   3. The `send_email` binding is already declared in wrangler.jsonc.
 * The `from` domain MUST be onboarded first — sending from an unverified domain
 * fails, and bounces from fake addresses damage sender reputation.
 *
 * Local dev: the binding is declared with `remote: true`, so a send goes through
 * the real service and needs `wrangler login`. When the binding or EMAIL_FROM is
 * absent, `sendEmail` reports `{ sent: false }` instead of throwing — a missing
 * email setup must not break the whole flow in development.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type EmailResult =
  | { sent: true; messageId: string }
  | { sent: false; reason: "notConfigured" | "failed" };

/**
 * Send one message.
 *
 * Never throws: a failed notification must not turn the request that triggered
 * it into a 500. The caller decides what a failure means, and every outcome is
 * logged as a structured event.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const env = getEnv();
  const from = env.EMAIL_FROM;

  if (!env.EMAIL || !from) {
    console.log(
      JSON.stringify({
        event: "email.not_configured",
        to: message.to,
        subject: message.subject,
        // Never log the body: reset links and other secrets live there.
        hasBinding: Boolean(env.EMAIL),
        hasFrom: Boolean(from),
      }),
    );
    return { sent: false, reason: "notConfigured" };
  }

  try {
    const response = await env.EMAIL.send({
      to: message.to,
      from: { email: from, name: env.EMAIL_FROM_NAME || from },
      subject: message.subject,
      // Always both: some clients only render text, and a text part improves
      // spam scoring.
      html: message.html,
      text: message.text,
    });

    console.log(
      JSON.stringify({
        event: "email.sent",
        to: message.to,
        subject: message.subject,
        messageId: response.messageId,
      }),
    );
    return { sent: true, messageId: response.messageId };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "email.failed",
        to: message.to,
        subject: message.subject,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return { sent: false, reason: "failed" };
  }
}

/** True when this deployment is a real one — used to gate dev-only conveniences. */
export function isProductionLike(): boolean {
  return (getEnv().SHOPIFY_APP_URL ?? "").startsWith("https://");
}
