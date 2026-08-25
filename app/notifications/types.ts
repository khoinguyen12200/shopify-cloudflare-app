// ─────────────────────────────────────────────────────────────────────────────
// The notification system's vocabulary. PURE — no I/O, no framework, safe to
// import from anywhere including the browser.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every notification this app can send.
 *
 * A CLOSED UNION, deliberately. If this were `string`, a typo in an event name
 * would be a **silent no-send**: nothing matches, nothing throws, and the
 * customer simply never hears from you. That failure is invisible in production
 * and expensive to find. Here it is a compile error.
 *
 * Add an event: add it here, add a spec to `catalogue.ts`, add a renderer. The
 * build fails until all three exist.
 */
export type NotificationEvent =
  | "admin_password_reset"
  /** A merchant opened a ticket, or replied to one → tell the staff on duty. */
  | "support_merchant_activity"
  /** Staff answered → tell the merchant, at the address they gave us. */
  | "support_staff_reply";

// ─── Messages ────────────────────────────────────────────────────────────────

/** Every transport this app can send over. */
export type ChannelKey = "email";

/**
 * A message is a DISCRIMINATED UNION, never "an email with optional fields".
 *
 * The tempting shortcut is one interface with `subject`, `html`, `body`, `to`…
 * and everything optional. Then SMS cannot satisfy it honestly, push has no
 * `subject`, and one medium's vocabulary leaks into every other. Each medium
 * describes only its own shape here.
 *
 * Adding SMS looks like:
 *   export interface SmsMessage { kind: "sms"; to: string; body: string }
 *   export type Message = EmailMessage | SmsMessage;
 * …and the compiler then tells you every place that must handle it.
 */
export interface EmailMessage {
  kind: "email";
  to: string;
  subject: string;
  html: string;
  /**
   * Plain-text alternative. REQUIRED, not optional: React Email renders it from
   * the same JSX as the HTML (see app/emails/render.ts), so there is never a
   * reason to omit it — and an HTML-only message is penalised by essentially
   * every spam filter. Making it optional is how a message ends up without one.
   */
  text: string;
  replyTo?: string;
  cc?: string[];
}

export type Message = EmailMessage;

// ─── Outcomes ────────────────────────────────────────────────────────────────

/**
 * Why a send was never attempted. A closed union, because this value is STORED
 * and then read back to decide what a human is told about it.
 *
 * ONE VOCABULARY for the whole system. The eligibility layer
 * (`eligibility/types.ts` → `BlockReason`) is an alias of this, deliberately: two
 * overlapping-but-different reason sets for the same concept is how the reason in
 * the database stops matching the reason on the screen, and nothing fails when
 * they drift.
 *
 * Add a member and every exhaustive reader stops compiling until it says what
 * this reason means — which is the point.
 */
export type RefusalReason =
  /**
   * The channel cannot send: no binding, not configured, not entitled, or this
   * event has no renderer for it.
   */
  | "channel_unavailable"
  /**
   * We hold no usable address for this recipient on this channel — absent,
   * malformed, or a reserved domain that can never receive mail.
   */
  | "recipient_unreachable"
  /** The recipient opted out. Legal; never bypassable. */
  | "recipient_opted_out"
  /** The tenant's settings do not select this channel for this event. */
  | "not_selected";

/** Why an attempted send failed. Same closed-union reasoning as above. */
export type FailureReason =
  /** The provider rejected it permanently — hard bounce, suppressed address. */
  | "rejected"
  /** Rate limited. Worth another attempt. */
  | "throttled"
  /** Provider 5xx, network fault, transport threw. Worth another attempt. */
  | "transport_error"
  /** We could not build the message — a missing renderer, bad data. */
  | "render_error";

/**
 * The result of one attempt, as a DISCRIMINATED UNION rather than
 * `{ success: boolean; error?: string; retriable?: boolean }`.
 *
 * This is the same principle as `Message` applied to the way out. With a flat
 * shape, `error` is optional on a success and `retriable` is meaningless there,
 * so every reader has to know which fields are live in which case. Here the
 * compiler knows.
 */
export type SendOutcome =
  | {
      status: "sent";
      /**
       * What the PROVIDER said happened to this recipient, verbatim.
       *
       * Kept separate from our own status because they are different facts: ours
       * means the API accepted the request, this means the provider believes it
       * was delivered. Collapsing them makes "are our emails arriving?"
       * unanswerable.
       */
      providerStatus?: string;
      /** Provider's id, so an async delivery callback can find this row. */
      providerMessageId?: string;
    }
  | {
      status: "failed";
      reason: FailureReason;
      /** Whether another attempt could plausibly succeed. */
      retriable: boolean;
      /** Free-form detail for a human reading the log. Never parsed. */
      detail?: string;
      providerStatus?: string;
    }
  | {
      status: "refused";
      reason: RefusalReason;
      detail?: string;
    };

/** Everything a channel needs beyond the message itself. */
export interface SendContext {
  /** Which shop this is for, when a channel resolves per-shop credentials. */
  shop?: string;
}

/**
 * A channel is TRANSPORT for one medium, and nothing else.
 *
 * No logging, no dedupe, no quota checks, no consent — those belong to
 * `dispatch` and to policies. A transport adapter that imports billing is a
 * transport adapter you cannot test or swap.
 */
export interface Channel<M extends Message = Message> {
  readonly key: M["kind"];
  send(message: M, context: SendContext): Promise<SendOutcome>;
}

/**
 * A gate that runs BEFORE a send but is not transport: quota, plan, consent,
 * quiet hours. Returns a refusal, or null to proceed.
 *
 * Separate from `Channel` so a channel with no policy simply has none, and so
 * adding a policy never touches transport code.
 */
export type Policy = (
  context: SendContext,
) => Promise<{ reason: RefusalReason; detail?: string } | null>;
