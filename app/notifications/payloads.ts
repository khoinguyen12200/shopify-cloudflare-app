import type { NotificationEvent } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// PER-EVENT PAYLOADS — the data a notification carries, independent of how any
// channel renders it.
//
// CHANNEL-NEUTRAL on purpose. An email builder and an SMS builder are two
// renderings of the SAME facts, so the facts do not belong to either of them. If
// this lived in `emails/`, adding SMS would mean either importing the email
// module for its types or duplicating the payload — and a duplicated payload
// drifts.
//
// Client-safe: types only, no renderers, no server imports.
//
// One payload per event, never one flat bag with everything optional. A flat
// `TemplateData` grows to twenty-odd fields, a renderer's signature stops saying
// what it actually reads, and a field every renderer silently ignores looks
// wired up.
// ─────────────────────────────────────────────────────────────────────────────

/** What every notification can rely on. */
export interface BasePayload {
  /** Recipient's display name, for the greeting. */
  recipientName: string;
  /** BCP-47 tag, so a channel can render in the recipient's language. */
  locale?: string;
  /** Absolute URL to a brand mark, when the channel can show one. */
  logoUrl?: string;
}

export interface AdminPasswordResetPayload extends BasePayload {
  /** The full reset URL, already built — renderers never construct links. */
  resetUrl: string;
  /** Already formatted for the recipient; a renderer does not know a locale's rules. */
  expiresIn: string;
}

/** Shared by both support notifications: the same thread, two audiences. */
interface SupportPayload extends BasePayload {
  /** The merchant's own words for what this is about. */
  subject: string;
  /**
   * A short excerpt of the new message, already truncated by the caller.
   * Renderers do not trim: where to cut is a content decision, and doing it in
   * the template means every channel invents its own length.
   */
  excerpt: string;
  /** Where to read and answer it. Built by the caller — templates never make links. */
  threadUrl: string;
}

export interface SupportMerchantActivityPayload extends SupportPayload {
  /** Which shop, so a staff inbox is triageable from the subject line alone. */
  shopName: string;
  /** Opened vs replied — the same facts, but a different thing to do about it. */
  isNew: boolean;
}

export interface SupportStaffReplyPayload extends SupportPayload {
  /** Who answered, so the merchant sees a person rather than an app. */
  staffName: string;
}

/**
 * Event → payload.
 *
 * Typed as a `Record<NotificationEvent, …>`, so adding an event to the union
 * without describing its data is a compile error.
 */
export interface PayloadByEvent extends Record<NotificationEvent, BasePayload> {
  admin_password_reset: AdminPasswordResetPayload;
  support_merchant_activity: SupportMerchantActivityPayload;
  support_staff_reply: SupportStaffReplyPayload;
}
