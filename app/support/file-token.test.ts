import { describe, it, expect } from "vitest";
import { signAttachmentToken, verifyAttachmentToken } from "./file-token";

const SECRET = "a-test-signing-secret";
const ID = "attachment-1";
const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

describe("an attachment access token", () => {
  it("verifies the token it just produced", async () => {
    // An <img> inside the Shopify admin iframe carries no session token, so the
    // URL itself has to carry the authorisation. This is that authorisation.
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });

    expect(
      await verifyAttachmentToken({
        secret: SECRET,
        attachmentId: ID,
        token,
        now: NOW,
      }),
    ).toBe(true);
  });

  it("is safe to put in a URL", async () => {
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });
    expect(token).toBe(encodeURIComponent(token));
  });

  it("does NOT verify for a different attachment", async () => {
    // The whole point: a token minted for my own screenshot must not read
    // another shop's. The id is inside the signed payload.
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });

    expect(
      await verifyAttachmentToken({
        secret: SECRET,
        attachmentId: "someone-elses-attachment",
        token,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("does NOT verify once it has expired", async () => {
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });

    expect(
      await verifyAttachmentToken({
        secret: SECRET,
        attachmentId: ID,
        token,
        now: NOW + HOUR + 1,
      }),
    ).toBe(false);
  });

  it("still verifies at the exact expiry instant", async () => {
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });

    expect(
      await verifyAttachmentToken({
        secret: SECRET,
        attachmentId: ID,
        token,
        now: NOW + HOUR,
      }),
    ).toBe(true);
  });

  it("does NOT verify when the expiry is edited to buy more time", async () => {
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });
    const [, signature] = token.split(".");
    const forged = `${NOW + 100 * HOUR}.${signature}`;

    expect(
      await verifyAttachmentToken({
        secret: SECRET,
        attachmentId: ID,
        token: forged,
        now: NOW + 2 * HOUR,
      }),
    ).toBe(false);
  });

  it("does NOT verify a tampered signature", async () => {
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });
    const [expiry, signature] = token.split(".");
    const flipped = signature.startsWith("A")
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;

    expect(
      await verifyAttachmentToken({
        secret: SECRET,
        attachmentId: ID,
        token: `${expiry}.${flipped}`,
        now: NOW,
      }),
    ).toBe(false);
  });

  it("does NOT verify under a different secret", async () => {
    const token = await signAttachmentToken({
      secret: SECRET,
      attachmentId: ID,
      expiresAt: NOW + HOUR,
    });

    expect(
      await verifyAttachmentToken({
        secret: "some-other-secret",
        attachmentId: ID,
        token,
        now: NOW,
      }),
    ).toBe(false);
  });

  it.each(["", "no-dot", "abc.def", ".", "1700000000000.", `${NOW}.$$$`])(
    "does NOT verify the malformed token %o",
    async (token) => {
      expect(
        await verifyAttachmentToken({
          secret: SECRET,
          attachmentId: ID,
          token,
          now: NOW,
        }),
      ).toBe(false);
    },
  );
});
