import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { SupportRepo } from "./support.server";
import { statusOf } from "~/support/status";

const SHOP = "alpha.myshopify.com";
const OTHER = "beta.myshopify.com";

setupTestDatabase();

const run = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

/** Open a ticket the way the service does: ticket + its first message. */
function open(
  repo: SupportRepo,
  over: { shop?: string; subject?: string; at?: number } = {},
) {
  const at = over.at ?? 1_700_000_000_000;
  return repo.open({
    shop: over.shop ?? SHOP,
    shopName: "Alpha Store",
    merchantEmail: "owner@alpha.test",
    ccEmails: [],
    category: "bug",
    subject: over.subject ?? "Button missing",
    body: "It vanished.",
    authorName: "Alpha Store",
    at,
  });
}

describe("SupportRepo", () => {
  it("opens a ticket whose first message is the merchant's, so it reads as open", async () => {
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo);

      const found = await repo.find(SHOP, ticket.id);
      expect(found).toBeDefined();
      expect(found?.ticket.subject).toBe("Button missing");
      expect(found?.messages).toHaveLength(1);
      expect(found?.messages[0]?.author).toBe("merchant");
      // Derived, not stored — the whole point of the model.
      expect(statusOf(found!.ticket)).toBe("open");
    });
  });

  it("CANNOT read another shop's ticket, even with the right id", async () => {
    // The id comes from a URL, so it is attacker-controlled. This is the
    // security test @rules/data.md requires, not a nice-to-have.
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo, { shop: SHOP });

      expect(await repo.find(OTHER, ticket.id)).toBeUndefined();
    });
  });

  it("CANNOT reply to another shop's ticket", async () => {
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo, { shop: SHOP });

      const replied = await repo.reply({
        shop: OTHER,
        ticketId: ticket.id,
        author: "merchant",
        authorName: "Beta Store",
        body: "let me in",
        at: 1_700_000_100_000,
      });

      expect(replied).toBe(false);
      // And the real owner's thread is untouched.
      const found = await repo.find(SHOP, ticket.id);
      expect(found?.messages).toHaveLength(1);
    });
  });

  it("lists only the asking shop's tickets", async () => {
    await run(async () => {
      const repo = new SupportRepo();
      await open(repo, { shop: SHOP, subject: "mine" });
      await open(repo, { shop: OTHER, subject: "theirs" });

      const mine = await repo.listForShop(SHOP);
      expect(mine.map((t) => t.subject)).toEqual(["mine"]);
    });
  });

  it("flips to answered when staff reply, and back to open when the merchant does", async () => {
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo, { at: 1000 });

      await repo.reply({
        shop: SHOP,
        ticketId: ticket.id,
        author: "staff",
        authorName: "Sam",
        body: "Looking now.",
        at: 2000,
      });
      let found = await repo.find(SHOP, ticket.id);
      expect(statusOf(found!.ticket)).toBe("answered");
      expect(found!.ticket.lastMessageAt).toBe(2000);

      await repo.reply({
        shop: SHOP,
        ticketId: ticket.id,
        author: "merchant",
        authorName: "Alpha Store",
        body: "Thanks!",
        at: 3000,
      });
      found = await repo.find(SHOP, ticket.id);
      expect(statusOf(found!.ticket)).toBe("open");
    });
  });

  it("reopens a closed ticket when the merchant replies", async () => {
    // Otherwise a merchant answering "did that fix it?" is never seen again.
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo, { at: 1000 });
      await repo.closeAsStaff(ticket.id, 2000);
      expect(statusOf((await repo.find(SHOP, ticket.id))!.ticket)).toBe("closed");

      await repo.reply({
        shop: SHOP,
        ticketId: ticket.id,
        author: "merchant",
        authorName: "Alpha Store",
        body: "Still broken.",
        at: 3000,
      });

      const found = await repo.find(SHOP, ticket.id);
      expect(statusOf(found!.ticket)).toBe("open");
      expect(found!.ticket.closedAt).toBeNull();
    });
  });

  it("does not reopen when STAFF reply to a closed ticket", async () => {
    // A closing note should not put the thread back in the queue.
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo, { at: 1000 });
      await repo.closeAsStaff(ticket.id, 2000);

      await repo.reply({
        shop: SHOP,
        ticketId: ticket.id,
        author: "staff",
        authorName: "Sam",
        body: "Closing — shipped in 1.2.",
        at: 3000,
      });

      expect(statusOf((await repo.find(SHOP, ticket.id))!.ticket)).toBe("closed");
    });
  });

  it("records read receipts per side without touching the other", async () => {
    await run(async () => {
      const repo = new SupportRepo();
      const ticket = await open(repo, { at: 1000 });

      await repo.markRead(SHOP, ticket.id, "staff", 5000);
      const found = await repo.find(SHOP, ticket.id);
      expect(found!.ticket.staffLastReadAt).toBe(5000);
      expect(found!.ticket.merchantLastReadAt).toBeNull();
    });
  });

  it("returns the staff queue newest-first, excluding closed threads", async () => {
    await run(async () => {
      const repo = new SupportRepo();
      await open(repo, { shop: SHOP, subject: "older", at: 1000 });
      await open(repo, { shop: OTHER, subject: "newer", at: 2000 });
      const closed = await open(repo, { shop: SHOP, subject: "closed", at: 1500 });
      await repo.closeAsStaff(closed.id, 1600);

      const queue = await repo.listOpenForStaff();
      expect(queue.map((t) => t.subject)).toEqual(["newer", "older"]);
      expect(queue.map((t) => t.id)).not.toContain(closed.id);
      // Cross-shop by design: this is the staff view, not a merchant's.
      expect(queue.some((t) => t.shop === OTHER)).toBe(true);
    });
  });

  it("purges every trace of a shop and reports the R2 keys to delete", async () => {
    // shop/redact: the blobs must be named before their rows disappear.
    await run(async () => {
      const repo = new SupportRepo();
      const mine = await open(repo, { shop: SHOP });
      const theirs = await open(repo, { shop: OTHER });
      await repo.attach({
        shop: SHOP,
        messageId: (await repo.find(SHOP, mine.id))!.messages[0]!.id,
        id: "att_1",
        r2Key: "support/alpha/x",
        filename: "a.png",
        contentType: "image/png",
        sizeBytes: 10,
        at: 1000,
      });

      const purged = await repo.purgeShop(SHOP);
      expect(purged.r2Keys).toEqual(["support/alpha/x"]);
      // 1 ticket + 1 message + 1 attachment.
      expect(purged.rows).toBe(3);
      expect(await repo.find(SHOP, mine.id)).toBeUndefined();
      // The other shop is untouched.
      expect(await repo.find(OTHER, theirs.id)).toBeDefined();
    });
  });
});
