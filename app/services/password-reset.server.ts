import { AdminUserRepo, normalizeEmail } from "~/models/admin-users.server";
import { PasswordResetTokenRepo } from "~/models/password-reset-tokens.server";
import { generateToken, hashToken } from "~/lib/token";
import { hashPassword } from "~/lib/password";
import { validatePasswordStrength } from "~/lib/password-policy";
import { notify } from "~/notifications/notify.server";

/** An unclicked link should not stay valid all day. */
export const TOKEN_TTL_MS = 60 * 60 * 1000;
/** Live links per account, so requesting repeatedly cannot flood an inbox. */
export const MAX_ACTIVE_TOKENS = 3;

/**
 * Ask for a reset link.
 *
 * ALWAYS resolves the same way, whatever happened. Whether the email exists,
 * whether the account is disabled, whether the throttle tripped, whether the
 * mail actually sent — the caller gets `{ requested: true }` and shows one
 * message. Any variation here is a user-enumeration oracle: "no account with
 * that email" tells an attacker which addresses are real.
 *
 * What actually happened is in the log, not in what the ROUTE renders.
 *
 * This function does report the facts to its caller — including the token when
 * one was issued — because a service's job is to say what happened, not to
 * decide what a user may see. **The route is responsible for never surfacing
 * `token` on a real deployment**; see routes/internal/forgot-password.tsx.
 */
export interface RequestResetOutcome {
  requested: true;
  /** Present only when a token was actually issued. Never send this to a client. */
  token?: string;
  emailSent: boolean;
}

export async function requestPasswordReset(input: {
  email: string;
  /** Origin of the incoming request, so the link points back at this deployment. */
  origin: string;
}): Promise<RequestResetOutcome> {
  const email = normalizeEmail(input.email);
  const now = Date.now();

  const user = await new AdminUserRepo().findByEmailWithHash(email);

  if (!user || user.status !== "active") {
    console.log(
      JSON.stringify({
        event: "password_reset.requested_unknown",
        email,
        // Distinguished in the log only — never in the response.
        reason: user ? "disabled" : "no_such_account",
      }),
    );
    return { requested: true, emailSent: false };
  }

  const tokens = new PasswordResetTokenRepo();
  if ((await tokens.countActiveForUser(user.id, now)) >= MAX_ACTIVE_TOKENS) {
    console.log(
      JSON.stringify({
        event: "password_reset.throttled",
        adminUserId: user.id,
        limit: MAX_ACTIVE_TOKENS,
      }),
    );
    return { requested: true, emailSent: false };
  }

  const token = generateToken();
  await tokens.create({
    tokenHash: await hashToken(token),
    adminUserId: user.id,
    expiresAt: now + TOKEN_TTL_MS,
    now,
  });

  // Goes through the notification system, so this send is logged, deduped and
  // rendered from the registered template like every other notification. The
  // dedupe key is the token itself: a retried job cannot email the same link
  // twice, while a genuinely new request has a new token and sends.
  const notified = await notify({
    event: "admin_password_reset",
    to: { email: user.email },
    dedupeKey: `admin_password_reset:${await hashToken(token)}`,
    payload: {
      recipientName: user.name,
      resetUrl: `${input.origin}/internal/reset-password/${token}`,
      expiresIn: "one hour",
    },
  });

  const [result] = notified.dispatched;
  const emailSent = result?.outcome.status === "sent";

  console.log(
    JSON.stringify({
      event: "password_reset.issued",
      adminUserId: user.id,
      emailSent,
      notificationLogId: result?.logId,
      // Recorded so a suppressed reset is explainable rather than mysterious.
      decisions: notified.decisions,
    }),
  );

  return { requested: true, token, emailSent };
}

export type ResetFailure =
  | "invalidToken"
  | "expiredToken"
  | "usedToken"
  | "tooShort"
  | "mismatch";

export type CompleteResetResult =
  | { ok: true }
  | { ok: false; reason: ResetFailure };

/** Is this token usable? Checked before rendering the form, and again on submit. */
export async function checkResetToken(
  token: string,
): Promise<{ ok: true; adminUserId: string } | { ok: false; reason: ResetFailure }> {
  const row = await new PasswordResetTokenRepo().findByHash(await hashToken(token));

  if (!row) return { ok: false, reason: "invalidToken" };
  // Used is reported separately from expired so a person who clicks an old link
  // twice gets an accurate message instead of a confusing one.
  if (row.usedAt !== null) return { ok: false, reason: "usedToken" };
  if (row.expiresAt <= Date.now()) return { ok: false, reason: "expiredToken" };

  return { ok: true, adminUserId: row.adminUserId };
}

/**
 * Spend the token and set the new password.
 *
 * The token is re-validated here, not trusted from the GET that rendered the
 * form: it can expire or be spent in between.
 */
export async function completePasswordReset(input: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<CompleteResetResult> {
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, reason: "mismatch" };
  }
  if (validatePasswordStrength(input.newPassword)) {
    return { ok: false, reason: "tooShort" };
  }

  const checked = await checkResetToken(input.token);
  if (!checked.ok) return checked;

  const now = Date.now();
  const tokens = new PasswordResetTokenRepo();

  await new AdminUserRepo().updatePassword(
    checked.adminUserId,
    await hashPassword(input.newPassword),
    now,
  );

  // Spend this one, then kill any sibling links still sitting in an inbox.
  await tokens.markUsed(await hashToken(input.token), now);
  await tokens.invalidateAllForUser(checked.adminUserId, now);

  console.log(
    JSON.stringify({
      event: "password_reset.completed",
      adminUserId: checked.adminUserId,
    }),
  );

  return { ok: true };
}
