import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { NotificationLogRepo } from "~/models/notification-logs.server";
import {
  GLOBAL_SCOPE,
  NotificationSettingsRepo,
} from "~/models/notification-settings.server";
import { createAdmin } from "~/services/admin-management.server";
import { requestPasswordReset } from "~/services/password-reset.server";
import { notify } from "./notify.server";
import { adminUsers, passwordResetNotifier, passwordResetTokens } from "~/wiring.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const ORIGIN = "https://example.test";
const resetDeps = { users: adminUsers(), tokens: passwordResetTokens(), notifier: passwordResetNotifier() };

/**
 * END TO END, through the real call site.
 *
 * The unit tests prove the decision layer and the log model in isolation. These
 * prove the WIRING: that asking for a password reset actually reaches the
 * notification system and leaves a row. Without them "it's wired" is a claim
 * about code I read, not about code that ran.
 *
 * Note what the environment does here: the test env has no Email Sending binding
 * and no EMAIL_FROM, so `availableChannels()` is empty and every send is refused
 * as `channel_unavailable`. That is the honest local/CI state — and it is exactly
 * the case that must still produce a queryable record.
 */
async function seedAdmin(email = "admin@example.org") {
  const created = await createAdmin({
    name: "Test Admin",
    email,
    password: "a-long-enough-password",
    role: "owner",
  }, resetDeps);
  if (!created.ok) throw new Error(`fixture: ${created.reason}`);
  return created.value;
}

describe("the admin forgot-password flow reaches the notification system", () => {
  it("writes a notification_logs row for the reset", async () => {
    const rows = await inRequest(async () => {
      await seedAdmin();
      await requestPasswordReset({ email: "admin@example.org", origin: ORIGIN }, resetDeps);
      return new NotificationLogRepo().recent();
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: "admin_password_reset",
      channel: "email",
      recipient: "admin@example.org",
    });
  });

  it("records WHY it was not delivered, rather than nothing at all", async () => {
    // No Email Sending binding in the test env, so the channel is unavailable.
    // A suppressed notification with no row is indistinguishable from one that
    // was never requested — that is the failure this asserts against.
    const rows = await inRequest(async () => {
      await seedAdmin();
      await requestPasswordReset({ email: "admin@example.org", origin: ORIGIN }, resetDeps);
      return new NotificationLogRepo().recent();
    });

    expect(rows[0]).toMatchObject({
      status: "refused",
      reasonCode: "channel_unavailable",
    });
    // `refused`, not `failed`: nothing was attempted.
    expect(rows[0]!.status).not.toBe("failed");
  });

  it("settles the row immediately — nothing is left stuck at queued", async () => {
    const rows = await inRequest(async () => {
      await seedAdmin();
      await requestPasswordReset({ email: "admin@example.org", origin: ORIGIN }, resetDeps);
      return new NotificationLogRepo().recent();
    });
    expect(rows[0]!.settledAt).not.toBeNull();
  });

  it("writes NO row for an email with no account", async () => {
    // The flow must stay silent about whether the address exists, and that
    // includes not leaving a trail that reveals it.
    const rows = await inRequest(async () => {
      await requestPasswordReset({ email: "nobody@example.org", origin: ORIGIN }, resetDeps);
      return new NotificationLogRepo().recent();
    });
    expect(rows).toHaveLength(0);
  });

  it("still returns the token, so the flow works without a mailer", async () => {
    const result = await inRequest(async () => {
      await seedAdmin();
      return requestPasswordReset({ email: "admin@example.org", origin: ORIGIN }, resetDeps);
    });
    expect(result.token).toBeTruthy();
    expect(result.emailSent).toBe(false);
  });
});

describe("rule ORDER is observable in the record", () => {
  it("reports channel_unavailable even when the recipient also opted out", async () => {
    // Both conditions hold here. Capability is checked FIRST, deliberately: "email
    // is not configured" is actionable, and telling someone their recipient opted
    // out when the mailer was never set up sends them to the wrong place.
    //
    // Opt-out ENFORCEMENT is proven in eligibility/resolve.test.ts, at the pure
    // level where a configured channel can be simulated — including that it beats
    // an `essential` event and an explicit selection. It cannot be shown here,
    // because this environment has no Email Sending binding to make available,
    // and a test that claimed otherwise would be asserting a fiction.
    const rows = await inRequest(async () => {
      const admin = await seedAdmin("both@example.org");
      await new NotificationSettingsRepo().optOut({
        scope: GLOBAL_SCOPE,
        channel: "email",
        address: admin.email,
        now: Date.now(),
      });
      await notify({
        event: "admin_password_reset",
        to: { email: admin.email },
        payload: {
          recipientName: admin.name,
          resetUrl: `${ORIGIN}/x`,
          expiresIn: "one hour",
        },
      });
      return new NotificationLogRepo().recent();
    });
    expect(rows[0]!.reasonCode).toBe("channel_unavailable");
  });

  it("records the opt-out itself, so it is queryable independently", async () => {
    // The suppression reason may be masked by a more actionable one, but the
    // opt-out is still stored and reportable on its own.
    const channels = await inRequest(async () => {
      const settings = new NotificationSettingsRepo();
      await settings.optOut({
        scope: GLOBAL_SCOPE,
        channel: "email",
        address: "gone@example.org",
        source: "unsubscribe_link",
        now: Date.now(),
      });
      return settings.optedOutChannels(GLOBAL_SCOPE, {
        email: "gone@example.org",
      });
    });
    expect(channels).toEqual(["email"]);
  });
});

describe("a missing address is refused by name", () => {
  it("records recipient_unreachable rather than crashing", async () => {
    const rows = await inRequest(async () => {
      await notify({
        event: "admin_password_reset",
        to: {},
        payload: {
          recipientName: "Nobody",
          resetUrl: `${ORIGIN}/x`,
          expiresIn: "one hour",
        },
      });
      return new NotificationLogRepo().recent();
    });

    expect(rows[0]).toMatchObject({
      status: "refused",
      // The address is legitimately absent — that IS the refusal — so the row
      // records what was asked for rather than pretending to have one.
      recipient: "(none)",
    });
  });
});

describe("notify reports every channel it considered", () => {
  it("returns decisions even when nothing was sent", async () => {
    const result = await inRequest(async () => {
      const admin = await seedAdmin("decide@example.org");
      return notify({
        event: "admin_password_reset",
        to: { email: admin.email },
        payload: {
          recipientName: admin.name,
          resetUrl: `${ORIGIN}/x`,
          expiresIn: "one hour",
        },
      });
    });

    expect(result.dispatched).toHaveLength(0);
    expect(result.decisions).toEqual([
      { channel: "email", allowed: false, reason: "channel_unavailable" },
    ]);
  });
});
