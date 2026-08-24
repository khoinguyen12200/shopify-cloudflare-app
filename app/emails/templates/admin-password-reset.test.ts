import { describe, it, expect } from "vitest";
import { adminPasswordResetEmail } from "./admin-password-reset";
import { palette } from "../tokens";

const PROPS = {
  recipientName: "Ada Lovelace",
  resetUrl: "https://example.test/internal/reset-password/abc123",
  expiresIn: "one hour",
};

describe("the password-reset email", () => {
  it("renders both an HTML and a text part", async () => {
    const email = await adminPasswordResetEmail(PROPS);

    expect(email.subject).toBe("Reset your password");
    // An HTML-only message is penalised by essentially every spam filter, and
    // the text part is rendered from the same JSX so it cannot drift.
    expect(email.html.length).toBeGreaterThan(200);
    expect(email.text.length).toBeGreaterThan(50);
    expect(email.html).not.toBe(email.text);
  });

  it("puts the reset URL in BOTH parts", async () => {
    const email = await adminPasswordResetEmail(PROPS);
    // A link that only survives in the HTML is unreachable for anyone reading
    // the text part, which is the whole reason the CTA shows the raw URL too.
    expect(email.html).toContain(PROPS.resetUrl);
    expect(email.text).toContain(PROPS.resetUrl);
  });

  it("greets the recipient in both parts", async () => {
    const email = await adminPasswordResetEmail(PROPS);
    expect(email.html).toContain("Ada Lovelace");
    expect(email.text).toContain("Ada Lovelace");
  });

  it("styles inline — email clients strip <style> blocks", async () => {
    const email = await adminPasswordResetEmail(PROPS);
    expect(email.html).toContain("style=");
    expect(email.html).not.toMatch(/<style[\s>]/);
    expect(email.html).not.toContain("<link");
  });

  it("uses the shared palette rather than an ad-hoc colour", async () => {
    const email = await adminPasswordResetEmail(PROPS);
    // The CTA background comes from tokens.ts, which tokens.test.ts pins to the
    // site's SCSS. So a brand change reaches the email.
    expect(email.html.toLowerCase()).toContain(palette.accent);
  });

  it("carries a preview line, so the inbox snippet is not 'Hello Name,'", async () => {
    const email = await adminPasswordResetEmail(PROPS);
    expect(email.html).toContain("Choose a new password for your account.");
  });

  it("escapes a name containing markup", async () => {
    const email = await adminPasswordResetEmail({
      ...PROPS,
      recipientName: '<script>alert("x")</script>',
    });
    // React escapes by construction; this asserts nothing bypasses it.
    expect(email.html).not.toContain("<script>alert");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("announces its language, so a translated email reads correctly", async () => {
    const email = await adminPasswordResetEmail({ ...PROPS, locale: "es" });
    expect(email.html).toContain('lang="es"');
  });

  it("renders with no logo, since clients block remote images by default", async () => {
    const email = await adminPasswordResetEmail(PROPS);
    // The brand name must be present as text, not only as an <img alt>.
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("TODO: Your App Name");
    // React Email uppercases headings in the plain-text rendering, so match
    // case-insensitively rather than asserting a shape it does not produce.
    expect(email.text.toLowerCase()).toContain("reset your password");
  });

  it("includes the logo when one is given", async () => {
    const email = await adminPasswordResetEmail({
      ...PROPS,
      logoUrl: "https://example.test/logo.png",
    });
    expect(email.html).toContain("https://example.test/logo.png");
  });
});
