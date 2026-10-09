import { normalizeEmail, type AdminUserPort } from "~/ports/admin-users";
import type { PasswordResetTokenPort } from "~/ports/password-reset-tokens";
import { generateToken, hashToken } from "~/lib/token";
import { hashPassword } from "~/lib/password";
import { validatePasswordStrength } from "~/lib/password-policy";
import type { NotifyRequest } from "~/ports/notifier";
import type { Notifier } from "~/ports/notifier";
import { absolute, paths } from "~/urls";
import type { Runtime } from "~/ports/runtime";

/** An unclicked link should not stay valid all day. */
export const TOKEN_TTL_MS = 60 * 60 * 1000;
/** Live links per account, so requesting repeatedly cannot flood an inbox. */
export const MAX_ACTIVE_TOKENS = 3;

/**
 * Hands the reset email to the notification queue. It resolves once the message
 * is queued, NOT once it is sent: whether the mail went out is recorded by the
 * consumer in `notification_logs` under the `logId` passed here.
 */
export interface PasswordResetNotifier {
  send(input: NotifyRequest<"admin_password_reset">): ReturnType<Notifier["send"]>;
}

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
  /**
   * The reset email was handed to the notifier for queueing. This says nothing
   * about delivery — that is the consumer's row under `notificationLogId`.
   */
  queued: boolean;
  /** Pre-minted id of the `notification_logs` row the send will write. */
  notificationLogId?: string;
}

type ResetDependencies = {
  users: Pick<AdminUserPort, "findByEmailWithHash">;
  tokens: Pick<PasswordResetTokenPort, "countActiveForUser" | "create">;
  notifier: PasswordResetNotifier;
  /** Mints the token, the log id (so the caller can name the row before it exists) and reads the time. */
  runtime: Runtime;
};

const notQueued = (): RequestResetOutcome => ({ requested: true, queued: false });

/** Mint a token, store only its hash, and return the raw value for the link. */
async function issueResetToken(deps: ResetDependencies, adminUserId: string, now: number): Promise<string> {
  const token = generateToken(deps.runtime.randomBytes);
  await deps.tokens.create({
    tokenHash: await hashToken(token),
    adminUserId,
    expiresAt: now + TOKEN_TTL_MS,
    now,
  });
  return token;
}

/**
 * Goes through the notification queue, so the request returns at once and the
 * send is logged, deduped, retried and rendered from the registered template
 * like every other notification. The dedupe key is the token's hash: a
 * redelivered message cannot email the same link twice, while a genuinely new
 * request has a new token and sends.
 */
async function queueResetEmail(
  deps: ResetDependencies,
  user: { readonly email: string; readonly name: string },
  token: string,
  origin: string,
): Promise<string> {
  const notificationLogId = deps.runtime.ids.uuid();
  await deps.notifier.send({
    event: "admin_password_reset",
    to: { email: user.email },
    dedupeKey: `admin_password_reset:${await hashToken(token)}`,
    logId: notificationLogId,
    payload: {
      recipientName: user.name,
      resetUrl: absolute(origin, paths.internal.resetPassword(token)),
      expiresIn: "one hour",
    },
  });
  return notificationLogId;
}

export async function requestPasswordReset(input: {
  email: string;
  /** Origin of the incoming request, so the link points back at this deployment. */
  origin: string;
}, deps: ResetDependencies): Promise<RequestResetOutcome> {
  const email = normalizeEmail(input.email);
  const now = deps.runtime.clock.now();

  const user = await deps.users.findByEmailWithHash(email);

  if (!user || user.status !== "active") {
    console.log(
      JSON.stringify({
        event: "password_reset.requested_unknown",
        // No email here: it is PII, and for an unknown account it is attacker-supplied.
        // Distinguished in the log only — never in the response.
        reason: user ? "disabled" : "no_such_account",
      }),
    );
    return notQueued();
  }

  if ((await deps.tokens.countActiveForUser(user.id, now)) >= MAX_ACTIVE_TOKENS) {
    console.log(
      JSON.stringify({
        event: "password_reset.throttled",
        adminUserId: user.id,
        limit: MAX_ACTIVE_TOKENS,
      }),
    );
    return notQueued();
  }

  const token = await issueResetToken(deps, user.id, now);
  const notificationLogId = await queueResetEmail(deps, user, token, input.origin);

  console.log(
    JSON.stringify({
      event: "password_reset.queued",
      adminUserId: user.id,
      notificationLogId,
    }),
  );

  return { requested: true, token, queued: true, notificationLogId };
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
  deps: { tokens: Pick<PasswordResetTokenPort, "findByHash">; runtime: Pick<Runtime, "clock"> },
): Promise<{ ok: true; adminUserId: string } | { ok: false; reason: ResetFailure }> {
  const row = await deps.tokens.findByHash(await hashToken(token));

  if (!row) return { ok: false, reason: "invalidToken" };
  // Used is reported separately from expired so a person who clicks an old link
  // twice gets an accurate message instead of a confusing one.
  if (row.usedAt !== null) return { ok: false, reason: "usedToken" };
  if (row.expiresAt <= deps.runtime.clock.now()) return { ok: false, reason: "expiredToken" };

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
}, deps: {
  users: Pick<AdminUserPort, "updatePassword">;
  tokens: Pick<PasswordResetTokenPort, "findByHash" | "markUsed" | "invalidateAllForUser">;
  runtime: Pick<Runtime, "clock" | "randomBytes">;
}): Promise<CompleteResetResult> {
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, reason: "mismatch" };
  }
  if (validatePasswordStrength(input.newPassword)) {
    return { ok: false, reason: "tooShort" };
  }

  const checked = await checkResetToken(input.token, deps);
  if (!checked.ok) return checked;

  const now = deps.runtime.clock.now();
  const tokens = deps.tokens;

  await deps.users.updatePassword(
    checked.adminUserId,
    await hashPassword(input.newPassword, deps.runtime.randomBytes),
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
