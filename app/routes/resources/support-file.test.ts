import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { SupportRepo } from "~/models/support.server";
import { signAttachmentToken } from "~/support/file-token";
import { loader } from "./support-file";

const SHOP = "alpha.myshopify.com";
const SECRET = "test-api-secret"; // matches vitest.config.ts

setupTestDatabase();

const run = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

/** An attachment row whose blob really exists in the test bucket. */
async function storedAttachment(): Promise<string> {
  const repo = new SupportRepo();
  const created = await repo.open({
    shop: SHOP,
    shopName: "Store",
    merchantEmail: "owner@store.test",
    ccEmails: [],
    category: "bug",
    subject: "Broken",
    body: "Look at this",
    authorName: "Store",
    at: 1_000,
  });

  const id = crypto.randomUUID();
  await env.UPLOADS.put(`support/${SHOP}/shot.png`, "pretend-png-bytes");
  await repo.attach({
    shop: SHOP,
    messageId: created.messageId,
    id,
    r2Key: `support/${SHOP}/shot.png`,
    filename: "shot.png",
    contentType: "image/png",
    sizeBytes: 17,
    at: 1_000,
  });
  return id;
}

/** The route is loader-only, so nothing here needs a router or a render. */
function get(id: string, token?: string) {
  const url = new URL(`https://example.test/support/file/${id}`);
  if (token !== undefined) url.searchParams.set("token", token);

  return loader({
    request: new Request(url),
    params: { id },
    context: new RouterContextProvider(),
    url,
    pattern: "/support/file/:id",
  });
}

describe("streaming a support attachment", () => {
  it("serves the file to a request carrying a valid token", async () => {
    // The embedded admin renders this URL in an <img>, which carries no session
    // token — so the URL itself has to be the authorisation.
    await run(async () => {
      const id = await storedAttachment();
      const token = await signAttachmentToken({
        secret: SECRET,
        attachmentId: id,
        expiresAt: Date.now() + 60_000,
      });

      const response = await get(id, token);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      // Read as bytes, not text: the body is declared image/png, and calling
      // .text() on it makes workerd (rightly) warn about corrupting it.
      const bytes = new Uint8Array(await response.arrayBuffer());
      expect(new TextDecoder().decode(bytes)).toBe("pretend-png-bytes");
    });
  });

  it("refuses a request with no token and no staff session", async () => {
    await run(async () => {
      const id = await storedAttachment();
      const response = await get(id);
      expect(response.status).toBe(404);
    });
  });

  it("refuses a token minted for a DIFFERENT attachment", async () => {
    // The security property that matters: a merchant holding one valid URL must
    // not be able to move the id and read someone else's screenshot.
    await run(async () => {
      const id = await storedAttachment();
      const token = await signAttachmentToken({
        secret: SECRET,
        attachmentId: "some-other-attachment",
        expiresAt: Date.now() + 60_000,
      });

      const response = await get(id, token);
      expect(response.status).toBe(404);
    });
  });

  it("refuses an expired token", async () => {
    await run(async () => {
      const id = await storedAttachment();
      const token = await signAttachmentToken({
        secret: SECRET,
        attachmentId: id,
        expiresAt: Date.now() - 1,
      });

      const response = await get(id, token);
      expect(response.status).toBe(404);
    });
  });

  it("refuses a token signed with the wrong secret", async () => {
    await run(async () => {
      const id = await storedAttachment();
      const token = await signAttachmentToken({
        secret: "not-our-secret",
        attachmentId: id,
        expiresAt: Date.now() + 60_000,
      });

      const response = await get(id, token);
      expect(response.status).toBe(404);
    });
  });

  it("404s an unknown attachment even with a token minted for that id", async () => {
    // Not-found and not-yours must be indistinguishable, or the 404 becomes an
    // oracle for which ids exist.
    await run(async () => {
      const token = await signAttachmentToken({
        secret: SECRET,
        attachmentId: "no-such-attachment",
        expiresAt: Date.now() + 60_000,
      });

      const response = await get("no-such-attachment", token);
      expect(response.status).toBe(404);
    });
  });
});
