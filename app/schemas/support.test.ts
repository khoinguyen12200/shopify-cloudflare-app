import { describe, it, expect } from "vitest";
import {
  readShopContact,
  CC_MAX,
  SUBJECT_MAX,
  BODY_MAX,
  ccEmailsSchema,
  createTicketSchema,
  replySchema,
} from "./support";

const parseCc = (raw: string) => ccEmailsSchema.safeParse(raw);

describe("ccEmailsSchema", () => {
  it("accepts an empty field — CC is optional", () => {
    const result = parseCc("");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual([]);
  });

  it("splits on commas, semicolons and newlines, which is how people paste", () => {
    const result = parseCc("a@shop.test, b@shop.test; c@shop.test\nd@shop.test");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(["a@shop.test", "b@shop.test", "c@shop.test", "d@shop.test"]);
    }
  });

  it("lower-cases and trims, so the same address cannot arrive twice", () => {
    const result = parseCc("  Owner@Shop.TEST , owner@shop.test ");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(["owner@shop.test"]);
  });

  it("drops empty entries from a trailing separator", () => {
    const result = parseCc("a@shop.test,,\n");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual(["a@shop.test"]);
  });

  it("rejects an address that is not an address", () => {
    // Every CC becomes an outbound send; a bad one is a bounce against our
    // sending reputation, so it is refused at the edge rather than stored.
    expect(parseCc("not-an-email").success).toBe(false);
  });

  it("caps the list, so one ticket cannot become a mailing list", () => {
    const many = Array.from({ length: CC_MAX + 1 }, (_, i) => `p${i}@shop.test`).join(",");
    expect(parseCc(many).success).toBe(false);
  });

  it("accepts exactly the cap", () => {
    const atCap = Array.from({ length: CC_MAX }, (_, i) => `p${i}@shop.test`).join(",");
    expect(parseCc(atCap).success).toBe(true);
  });

  it("counts duplicates once against the cap", () => {
    // Deduping AFTER the cap would reject a paste of the same address twice.
    const dupes = `${Array.from({ length: CC_MAX }, (_, i) => `p${i}@shop.test`).join(",")},p0@shop.test`;
    expect(parseCc(dupes).success).toBe(true);
  });
});

describe("createTicketSchema", () => {
  const valid = {
    category: "bug",
    subject: "The team order button is missing",
    body: "It disappeared this morning.",
    ccEmails: "",
  };

  it("accepts a well-formed ticket", () => {
    expect(createTicketSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a real subject and body, not just whitespace", () => {
    expect(createTicketSchema.safeParse({ ...valid, subject: "   " }).success).toBe(false);
    expect(createTicketSchema.safeParse({ ...valid, body: "\n\n" }).success).toBe(false);
  });

  it("trims the subject and body it returns", () => {
    const result = createTicketSchema.safeParse({
      ...valid,
      subject: "  padded  ",
      body: "  text  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject).toBe("padded");
      expect(result.data.body).toBe("text");
    }
  });

  it("refuses an unknown category rather than guessing one", () => {
    expect(createTicketSchema.safeParse({ ...valid, category: "urgent" }).success).toBe(false);
  });

  it("bounds subject and body, so one request cannot fill the table", () => {
    expect(
      createTicketSchema.safeParse({ ...valid, subject: "s".repeat(SUBJECT_MAX + 1) }).success,
    ).toBe(false);
    expect(
      createTicketSchema.safeParse({ ...valid, body: "b".repeat(BODY_MAX + 1) }).success,
    ).toBe(false);
  });

  it("treats a missing ccEmails field as no CCs", () => {
    const { ccEmails: _omitted, ...withoutCc } = valid;
    const result = createTicketSchema.safeParse(withoutCc);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.ccEmails).toEqual([]);
  });

  it("accepts an optional reply address and normalises it", () => {
    const result = createTicketSchema.safeParse({ ...valid, merchantEmail: " Me@Shop.TEST " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.merchantEmail).toBe("me@shop.test");
  });

  it("treats a blank reply address as none, not as invalid", () => {
    // The field is prefilled but clearable; an empty string must not fail the form.
    const result = createTicketSchema.safeParse({ ...valid, merchantEmail: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.merchantEmail).toBeNull();
  });
});

describe("replySchema", () => {
  it("accepts a body with no attachments", () => {
    const result = replySchema.safeParse({ body: "Any update?", uploadIds: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.uploadIds).toEqual([]);
  });

  it("accepts attachments with no body — a screenshot can be the whole reply", () => {
    const result = replySchema.safeParse({ body: "", uploadIds: "up_1,up_2" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.uploadIds).toEqual(["up_1", "up_2"]);
  });

  it("refuses a reply that is entirely empty", () => {
    expect(replySchema.safeParse({ body: "  ", uploadIds: "" }).success).toBe(false);
  });
});

describe("readShopContact", () => {
  it("prefers the account owner's address over the public contact one", () => {
    const contact = readShopContact({
      data: { shop: { name: "Alpha", email: "owner@alpha.test", contactEmail: "hi@alpha.test" } },
    });
    expect(contact).toEqual({ name: "Alpha", email: "owner@alpha.test" });
  });

  it("falls back to the public contact address when there is no owner email", () => {
    const contact = readShopContact({ data: { shop: { name: "A", contactEmail: "hi@a.test" } } });
    expect(contact.email).toBe("hi@a.test");
  });

  it("returns empty strings for a partial or unexpected response", () => {
    // A cast would have produced `undefined` here and pushed it into the form.
    expect(readShopContact({})).toEqual({ name: "", email: "" });
    expect(readShopContact(null)).toEqual({ name: "", email: "" });
    expect(readShopContact({ data: { shop: {} } })).toEqual({ name: "", email: "" });
  });

  it("ignores a response whose shape is wrong rather than throwing", () => {
    expect(readShopContact({ data: { shop: { name: 42 } } })).toEqual({ name: "", email: "" });
  });
});
