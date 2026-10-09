import { describe, expect, it } from "vitest";
import { err, ok } from "~/lib/result";
import { renderRoute } from "~/test/render-route";
import NewTicket from "./new";

const never = new Promise<never>(() => undefined);

const form = (defaultEmail: Promise<unknown>, stage: "pending" | "settled", locale: "en" | "es" = "en") =>
  renderRoute({ path: "/app/support/new", Component: NewTicket, loaderData: { defaultEmail }, stage, locale });

describe("streaming the new-ticket form", () => {
  it("renders the whole form at once, with only the contact email held back", async () => {
    const html = await form(never, "pending");

    expect(html).toContain('<s-page heading="New ticket"');
    expect(html).toContain('name="subject"');
    expect(html).toContain('name="body"');
    // The pending twin is disabled and carries no name, so it can never submit a blank address.
    expect(html).toContain("Loading your store&#x27;s contact email");
    expect(html).toContain("disabled");
    expect(html).not.toContain('name="merchantEmail"');
  });

  it("prefills the contact email once Shopify answers", async () => {
    const html = await form(Promise.resolve(ok("owner@acme.shop")), "settled");
    expect(html).toContain('name="merchantEmail"');
    expect(html).toContain('value="owner@acme.shop"');
  });

  it("leaves an empty, editable email field when the lookup failed, rather than a wrong address", async () => {
    const html = await form(Promise.resolve(err("failed")), "settled");
    const field = /<s-email-field[^>]*name="merchantEmail"[^>]*>/.exec(html)?.[0];
    expect(field, "the email field must still render").toBeDefined();
    expect(field).not.toContain("value=");
  });

  it("translates the pending copy", async () => {
    const html = await form(never, "pending", "es");
    expect(html).toContain("Cargando el correo de contacto de tu tienda");
  });
});
