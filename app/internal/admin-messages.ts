import type { AdminErrorReason } from "~/services/admin-management.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password-policy";

/**
 * English copy for the admin-management error reasons, shared by every
 * console page that surfaces them. The internal console has no i18n — see
 * AGENTS.md — so this is the one place the mapping lives.
 */
export const ADMIN_ERRORS: Record<AdminErrorReason, string> = {
  nameRequired: "A name is required.",
  emailInvalid: "Enter a valid email address.",
  emailTaken: "An account with that email already exists.",
  tooShort: `The password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  notFound: "That account no longer exists.",
  lastOwner: "This is the last active owner. Promote someone else first.",
  notYourself: "You cannot do that to your own account.",
  forbidden: "Only an owner can manage admins.",
};

export const ADMIN_ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin",
} as const;

export const ADMIN_STATUS_LABEL = {
  active: "Active",
  disabled: "Disabled",
} as const;
