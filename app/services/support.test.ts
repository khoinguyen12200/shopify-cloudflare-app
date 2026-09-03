import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { NotificationLogRepo } from "~/models/notification-logs.server";
import { AdminUserRepo } from "~/models/admin-users.server";
import { SupportRepo } from "~/models/support.server";
import { createAdmin } from "~/services/admin-management.server";
import { SupportService } from "./support.server";
import { supportService } from "~/wiring.server";
import { verifyAttachmentToken } from "~/support/file-token";
import { fakeNotifier } from "~/test/fake-notifier";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const adminDeps = { users: new AdminUserRepo() };

/**
 * The support service's WIRING, against real D1.
 *
 * The pure pieces — status, excerpt, the copy list, the price line — are unit
 * tested next to themselves. What this file proves is the part that had no test
 * at all: that opening a ticket, replying to it, and answering it each actually
 * reach the notification system and leave a queryable row.
 *
 * Note what the environment does: the test env has no Email Sending binding, so
 * every send is refused as `channel_unavailable`. That is the honest local state
 * — and it is exactly the case that must still produce a record, because a
 * suppressed notification with no row is indistinguishable from one that was
 * never requested.
 */

/**
 * A fresh shop per test. SUPPORT_LIMITER is a REAL binding here, its buckets are
 * keyed by shop, and they survive `clearAllTables` — 10 writes per minute per
 * shop (wrangler.jsonc). Sharing one domain across the file makes whichever test
 * runs eleventh fail with `rate_limited`, which reads as a bug in that test
 * rather than as shared state.
 */
const newShop = () => `s-${crypto.randomUUID()}.myshopify.com`;

async function staffMember(email = "support@example.org") {
  const created = await createAdmin({
    name: "Sam Staff",
    email,
    password: "a-long-enough-password",
    role: "owner",
  }, adminDeps);
  if (!created.ok) throw new Error(`fixture: ${created.reason}`);
  await new AdminUserRepo().setNotifySupport(created.value.id, true, 1_000);
  return created.value;
}

async function openTicket(
  service: SupportService,
  shop: string,
  over: Partial<Parameters<SupportService["openTicket"]>[0]> = {},
) {
  const opened = await service.openTicket({
    shop,
    shopName: "Alpha Store",
    merchantEmail: "owner@alpha.test",
    ccEmails: [],
    category: "bug",
    subject: "Checkout is broken",
    body: "It fails at payment.",
    ...over,
  });
  if (!opened.ok) throw new Error(`fixture: ${opened.reason}`);
  return opened.value;
}

describe("opening a ticket", () => {
  it("adopts uploaded attachments through injected repository", async () => {
    const calls: string[] = [];
    const repo = {
      attach: async () => { calls.push("attach"); }, open: async () => ({ id: "t", messageId: "m" }), reply: async () => false,
      replyAsStaff: async () => undefined, find: async () => undefined, findForStaff: async () => undefined,
      listForShop: async () => [], listOpenForStaff: async () => [], closeAsStaff: async () => false,
      setCcEmails: async () => false, markRead: async () => {}, markReadAsStaff: async () => {},
    };
    const service = new SupportService({ repo, admins: { supportNotifyRecipients: async () => [] }, clock: { now: () => 1 }, notifier: { send: async () => {} }, appUrl: "https://app.test", withinRateLimit: async () => true, signAttachment: async () => "token" });
    await service.adoptAttachments("shop.test", "message", [{ id: "upload", r2Key: "key", filename: "a.txt", contentType: "text/plain", sizeBytes: 1 }]);
    expect(calls).toEqual(["attach"]);
  });

  it("uses injected support repository", async () => {
    const calls: string[] = [];
    const repo = {
      attach: async () => {},
      open: async () => { calls.push("open"); return { id: "ticket", messageId: "message" }; },
      reply: async () => false,
      replyAsStaff: async () => undefined,
      find: async () => undefined,
      findForStaff: async () => undefined,
      listForShop: async () => [],
      listOpenForStaff: async () => [],
      closeAsStaff: async () => false,
      setCcEmails: async () => false,
      markRead: async () => {},
      markReadAsStaff: async () => {},
    };
    const service = new SupportService({ repo, admins: { supportNotifyRecipients: async () => [] }, clock: { now: () => 1 }, notifier: { send: async () => {} }, appUrl: "https://app.test", withinRateLimit: async () => true, signAttachment: async () => "token" });
    const result = await service.openTicket({ shop: "shop.myshopify.com", shopName: "Shop", merchantEmail: null, ccEmails: [], category: "bug", subject: "Subject", body: "Body" });
    expect(result).toEqual({ ok: true, value: { id: "ticket", messageId: "message" } });
    expect(calls).toEqual(["open"]);
  });

  it("stores the ticket against the shop that opened it", async () => {
    const shop = newShop();
    const thread = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      return service.find(shop, created.id);
    });

    expect(thread?.ticket).toMatchObject({
      shop,
      subject: "Checkout is broken",
      lastAuthor: "merchant",
    });
    expect(thread?.messages).toHaveLength(1);
  });

  it("cannot be read by another shop", async () => {
    // The security property: a ticket id is in a URL the merchant can edit.
    const shop = newShop();
    const other = newShop();
    const found = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      return service.find(other, created.id);
    });

    expect(found).toBeUndefined();
  });

  it("stores the copy list the merchant gave", async () => {
    const shop = newShop();
    const thread = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop, {
        ccEmails: ["dev@alpha.test", "ops@alpha.test"],
      });
      return service.find(shop, created.id);
    });

    expect(thread?.ticket.ccEmails).toEqual(["dev@alpha.test", "ops@alpha.test"]);
  });

  it("notifies the staff who asked to hear about tickets", async () => {
    const rows = await inRequest(async () => {
      await staffMember();
      await openTicket(supportService(), newShop());
      return new NotificationLogRepo().recent();
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: "support_merchant_activity",
      channel: "email",
      recipient: "support@example.org",
    });
  });

  it("notifies EVERY opted-in staff member separately", async () => {
    // One send each, so one bad address cannot suppress the rest and each row
    // in the log names one person.
    const rows = await inRequest(async () => {
      await staffMember("first@example.org");
      await staffMember("second@example.org");
      await openTicket(supportService(), newShop());
      return new NotificationLogRepo().recent();
    });

    expect(rows.map((row) => row.recipient).sort()).toEqual([
      "first@example.org",
      "second@example.org",
    ]);
  });

  it("does not notify a staff member who opted out of support mail", async () => {
    const rows = await inRequest(async () => {
      const staff = await staffMember();
      await new AdminUserRepo().setNotifySupport(staff.id, false, 2_000);
      await openTicket(supportService(), newShop());
      return new NotificationLogRepo().recent();
    });

    expect(rows).toHaveLength(0);
  });

  it("still opens the ticket when there is nobody to notify", async () => {
    // A mail transport being down, or an empty staff list, must never be the
    // reason a bug report is lost.
    const shop = newShop();
    const thread = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      return service.find(shop, created.id);
    });

    expect(thread).toBeDefined();
  });

  it("refuses once the shop has burnt its write allowance", async () => {
    // Ticket writes cost rows, storage and staff attention, so they go through
    // the limiter — 10 per minute per shop.
    const shop = newShop();
    const reason = await inRequest(async () => {
      const service = supportService();
      for (let i = 0; i < 10; i += 1) await openTicket(service, shop);

      const eleventh = await service.openTicket({
        shop,
        shopName: "Alpha Store",
        merchantEmail: "owner@alpha.test",
        ccEmails: [],
        category: "bug",
        subject: "One too many",
        body: "…",
      });
      return eleventh.ok ? null : eleventh.reason;
    });

    expect(reason).toBe("rate_limited");
  });
});

describe("replying", () => {
  it("records a merchant reply and notifies staff again", async () => {
    const shop = newShop();
    const { thread, rows } = await inRequest(async () => {
      await staffMember();
      const service = supportService();
      const created = await openTicket(service, shop);

      const replied = await service.replyAsMerchant({
        shop,
        shopName: "Alpha Store",
        ticketId: created.id,
        body: "Still broken today.",
      });
      expect(replied.ok).toBe(true);

      return {
        thread: await service.find(shop, created.id),
        rows: await new NotificationLogRepo().recent(),
      };
    });

    expect(thread?.messages).toHaveLength(2);
    // One for opening, one for the reply.
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.event === "support_merchant_activity")).toBe(true);
  });

  it("refuses a merchant reply to a ticket that is not theirs", async () => {
    const shop = newShop();
    const other = newShop();
    const replied = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      return service.replyAsMerchant({
        shop: other,
        shopName: "Beta Store",
        ticketId: created.id,
        body: "Let me in.",
      });
    });

    expect(replied).toEqual({ ok: false, reason: "not_found" });
  });

  it("emails the merchant when staff answer", async () => {
    const shop = newShop();
    const rows = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);

      const replied = await service.replyAsStaff({
        ticketId: created.id,
        staffName: "Sam",
        body: "Fixed in 1.2.",
      });
      expect(replied.ok).toBe(true);

      return new NotificationLogRepo().recent();
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      event: "support_staff_reply",
      recipient: "owner@alpha.test",
    });
  });

  it("sends nothing when the merchant left no reply address", async () => {
    // Clearing the address is a real choice on the form — "notify me in the app
    // only" — and it must not become a send to an empty string.
    const shop = newShop();
    const rows = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop, { merchantEmail: null });
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Hi" });
      return new NotificationLogRepo().recent();
    });

    expect(rows).toHaveLength(0);
  });

  it("scopes the merchant's notification to their own shop", async () => {
    // The log row carries the tenant, so support mail for one shop can never be
    // attributed to another.
    const shop = newShop();
    const rows = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Hi" });
      return new NotificationLogRepo().recent();
    });

    expect(rows[0]?.shop).toBe(shop);
  });

  it("reopens a closed thread when the merchant replies, but not when staff do", async () => {
    const shop = newShop();
    const { afterStaff, afterMerchant } = await inRequest(async () => {
      const service = supportService();
      const repo = new SupportRepo();
      const created = await openTicket(service, shop);
      await repo.closeAsStaff(created.id, 2_000);

      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Closing note" });
      const afterStaff = (await service.find(shop, created.id))?.ticket.closedAt;

      await service.replyAsMerchant({
        shop,
        shopName: "Alpha Store",
        ticketId: created.id,
        body: "Actually still broken.",
      });
      const afterMerchant = (await service.find(shop, created.id))?.ticket.closedAt;

      return { afterStaff, afterMerchant };
    });

    expect(afterStaff).toBe(2_000);
    expect(afterMerchant).toBeNull();
  });

  it("reports not_found when staff answer a ticket that no longer exists", async () => {
    const replied = await inRequest(() =>
      supportService().replyAsStaff({
        ticketId: "no-such-ticket",
        staffName: "Sam",
        body: "Hello?",
      }),
    );

    expect(replied).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("the copy list on an existing ticket", () => {
  it("is replaced wholesale by the merchant's edit", async () => {
    const shop = newShop();
    const thread = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop, { ccEmails: ["old@alpha.test"] });
      await service.setCcEmails(shop, created.id, ["new@alpha.test"]);
      return service.find(shop, created.id);
    });

    expect(thread?.ticket.ccEmails).toEqual(["new@alpha.test"]);
  });

  it("cannot be edited by another shop", async () => {
    const shop = newShop();
    const other = newShop();
    const thread = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop, { ccEmails: ["old@alpha.test"] });
      await service.setCcEmails(other, created.id, ["attacker@evil.test"]);
      return service.find(shop, created.id);
    });

    expect(thread?.ticket.ccEmails).toEqual(["old@alpha.test"]);
  });
});

describe("read receipts", () => {
  it("marks the merchant's side read without touching the staff side", async () => {
    const shop = newShop();
    const ticket = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      await service.markMerchantRead(shop, created.id);
      return (await service.find(shop, created.id))?.ticket;
    });

    expect(ticket?.merchantLastReadAt).not.toBeNull();
    expect(ticket?.staffLastReadAt).toBeNull();
  });
});

describe("attachment URLs", () => {
  it("mints a URL whose token verifies for that attachment", async () => {
    const shop = newShop();
    const { url, id } = await inRequest(async () => {
      const service = supportService();
      const created = await openTicket(service, shop);
      const attachmentId = crypto.randomUUID();

      await new SupportRepo().attach({
        shop,
        messageId: created.messageId,
        id: attachmentId,
        r2Key: "support/alpha/shot.png",
        filename: "shot.png",
        contentType: "image/png",
        sizeBytes: 10,
        at: 1_000,
      });

      return { url: await service.attachmentUrl(attachmentId), id: attachmentId };
    });

    const token = new URL(url, "https://example.test").searchParams.get("token") ?? "";
    expect(url).toContain(`/support/file/${id}`);
    expect(
      await verifyAttachmentToken({
        secret: "test-api-secret",
        attachmentId: id,
        token,
        now: Date.now(),
      }),
    ).toBe(true);
  });

  it("mints a token that does NOT verify for a different attachment", async () => {
    const url = await inRequest(() =>
      supportService().attachmentUrl("attachment-a"),
    );

    const token = new URL(url, "https://example.test").searchParams.get("token") ?? "";
    expect(
      await verifyAttachmentToken({
        secret: "test-api-secret",
        attachmentId: "attachment-b",
        token,
        now: Date.now(),
      }),
    ).toBe(false);
  });
});


/**
 * What the service ASKS FOR, observed at the port.
 *
 * These are the assertions that were impossible before the `Notifier` port
 * existed: an email leaves no row to check, so "the copy list is carried on the
 * reply" was a claim about code rather than about behaviour — and it was false
 * for as long as the feature shipped.
 */
describe("what the service asks the notifier to send", () => {
  const withFake = () => {
    const notifier = fakeNotifier();
    const service = new SupportService({
      repo: new SupportRepo(),
      admins: new AdminUserRepo(),
      clock: { now: () => 1_700_000_000_000 },
      notifier,
      appUrl: "https://example.test",
      withinRateLimit: async () => true,
      signAttachment: async () => "unused",
    });
    return { notifier, service };
  };

  it("carries the ticket's copy list on the staff reply", async () => {
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop, {
        ccEmails: ["dev@alpha.test", "ops@alpha.test"],
      });
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Fixed." });
      return notifier;
    });

    const request = notifier.onlyFor("support_staff_reply");
    expect(request.to).toEqual({ email: "owner@alpha.test" });
    expect(request.cc).toEqual({ email: ["dev@alpha.test", "ops@alpha.test"] });
  });

  it("scopes the staff reply to the ticket's shop, so opt-outs resolve per tenant", async () => {
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop);
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Fixed." });
      return notifier;
    });

    expect(notifier.onlyFor("support_staff_reply").scope).toBe(shop);
  });

  it("sends an EMPTY copy list rather than omitting it when nobody is copied", async () => {
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop, { ccEmails: [] });
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Fixed." });
      return notifier;
    });

    expect(notifier.onlyFor("support_staff_reply").cc).toEqual({ email: [] });
  });

  it("answers the merchant in the language they wrote in", async () => {
    // The staff member replies from the internal console, whose request knows
    // nothing about the merchant — so the locale has to come off the ticket.
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop, { locale: "es" });
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Arreglado." });
      return notifier;
    });

    expect(notifier.onlyFor("support_staff_reply").payload).toMatchObject({
      locale: "es",
    });
  });

  it("leaves the locale unset for a ticket opened before we recorded one", async () => {
    // Null, not "en": the sender falls back to the default rather than this
    // claiming we know the merchant reads English.
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop);
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Fixed." });
      return notifier;
    });

    expect(notifier.onlyFor("support_staff_reply").payload.locale).toBeUndefined();
  });

  it("names the staff member who answered, so the merchant sees a person", async () => {
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop);
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Fixed." });
      return notifier;
    });

    expect(notifier.onlyFor("support_staff_reply").payload).toMatchObject({
      staffName: "Sam",
      subject: "Checkout is broken",
    });
  });

  it("does NOT copy anyone on the staff-facing notification", async () => {
    // The copy list is the merchant's, for their own thread. Staff each get
    // their own individual email.
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      await staffMember();
      await openTicket(service, newShop(), { ccEmails: ["dev@alpha.test"] });
      return notifier;
    });

    expect(notifier.onlyFor("support_merchant_activity").cc).toBeUndefined();
  });

  it("marks a newly opened ticket as new, and a merchant reply as not", async () => {
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      await staffMember();
      const created = await openTicket(service, shop);
      await service.replyAsMerchant({
        shop,
        shopName: "Alpha Store",
        ticketId: created.id,
        body: "Any news?",
      });
      return notifier;
    });

    const requests = notifier.forEvent("support_merchant_activity");
    expect(requests).toHaveLength(2);
    expect(requests[0]?.payload).toMatchObject({ isNew: true });
    expect(requests[1]?.payload).toMatchObject({ isNew: false });
  });

  it("asks for nothing at all when the merchant left no reply address", async () => {
    const shop = newShop();
    const notifier = await inRequest(async () => {
      const { notifier, service } = withFake();
      const created = await openTicket(service, shop, { merchantEmail: null });
      await service.replyAsStaff({ ticketId: created.id, staffName: "Sam", body: "Hi" });
      return notifier;
    });

    expect(notifier.forEvent("support_staff_reply")).toEqual([]);
  });
});
