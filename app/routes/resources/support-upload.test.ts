import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "cloudflare:test";
import { RouterContextProvider } from "react-router";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import { AdminUserRepo } from "~/models/admin-users.server";
import { SupportRepo } from "~/models/support.server";
import { createAdminSession } from "~/services/admin-auth.server";
import { action } from "./support-upload";

setupTestDatabase();

const SHOP = "upload-compensation.myshopify.com";
const TRIGGER = "reject_pending_upload_staging";

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);

afterEach(async () => {
  await env.DB.prepare(`DROP TRIGGER IF EXISTS ${TRIGGER}`).run();
});

function actionArgs(request: Request) {
  return {
    request,
    params: {},
    context: new RouterContextProvider(),
    url: new URL(request.url),
    pattern: "/support/upload",
  };
}

function cookieFrom(response: Response): string {
  const cookie = response.headers.get("Set-Cookie");
  if (!cookie) throw new Error("expected staff session cookie");
  return cookie.split(";")[0]!;
}

async function staffCookie(): Promise<string> {
  const admin = await new AdminUserRepo().create({
    id: crypto.randomUUID(),
    email: "upload-compensation@example.org",
    name: "Support",
    passwordHash: "not-used-by-this-session-test",
    role: "owner",
    now: 1,
  });
  return cookieFrom(await createAdminSession(admin.id, "/internal/dashboard"));
}

async function ticketId(): Promise<string> {
  const ticket = await new SupportRepo().open({
    shop: SHOP,
    shopName: "Upload compensation",
    merchantEmail: null,
    ccEmails: [],
    category: "bug",
    subject: "Stage a file",
    body: "The upload should be cleaned up when staging fails.",
    authorName: "Merchant",
    locale: null,
    at: 1,
  });
  return ticket.id;
}

describe("support upload staging", () => {
  it("keeps an oversized object discoverable when immediate cleanup fails", async () => {
    const deleteObject = vi.spyOn(env.UPLOADS, "delete").mockRejectedValue(new Error("cleanup unavailable"));
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await inRequest(async () => {
        const cookie = await staffCookie();
        const id = await ticketId();
        const body = new Uint8Array(10 * 1024 * 1024 + 1);
        const request = new Request("https://example.test/support/upload", {
          method: "POST",
          body,
          headers: {
            Cookie: cookie,
            "Content-Type": "image/png",
            "Content-Length": "1",
            "X-Support-Filename": "screen.png",
            "X-Support-Ticket": id,
          },
        });

        const result = await action(actionArgs(request));
        expect(result).toMatchObject({ data: { error: "too_large" } });
        const pending = await new SupportRepo().listExpiredUploads(Date.now() + 24 * 60 * 60 * 1000 + 1);
        expect(pending).toHaveLength(1);
      });
      expect(report).toHaveBeenCalledWith(expect.stringContaining('"event":"support.upload_size_cleanup_failed"'));
    } finally {
      deleteObject.mockRestore();
      report.mockRestore();
    }
  });

  it("removes the R2 object when pending-upload staging rejects it", async () => {
    await inRequest(async () => {
      const cookie = await staffCookie();
      const id = await ticketId();
      await env.DB.prepare(`
        CREATE TRIGGER ${TRIGGER}
        BEFORE INSERT ON pending_uploads
        BEGIN
          SELECT RAISE(ABORT, 'staging rejected');
        END
      `).run();

      const body = "png-bytes";
      const request = new Request("https://example.test/support/upload", {
        method: "POST",
        body,
        headers: {
          Cookie: cookie,
          "Content-Type": "image/png",
          "Content-Length": String(body.length),
          "X-Support-Filename": "screen.png",
          "X-Support-Ticket": id,
        },
      });

      await expect(action(actionArgs(request))).rejects.toThrow("pending_uploads");

      const objects = await env.UPLOADS.list({ prefix: `support/${SHOP}/${id}/` });
      expect(objects.objects).toEqual([]);
    });
  });

  it("logs when R2 compensation fails after pending-upload staging rejects", async () => {
    const deleteObject = vi.spyOn(env.UPLOADS, "delete").mockRejectedValue(
      new Error("cleanup unavailable"),
    );
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await inRequest(async () => {
        const cookie = await staffCookie();
        const id = await ticketId();
        await env.DB.prepare(`
          CREATE TRIGGER ${TRIGGER}
          BEFORE INSERT ON pending_uploads
          BEGIN
            SELECT RAISE(ABORT, 'staging rejected');
          END
        `).run();

        const body = "png-bytes";
        const request = new Request("https://example.test/support/upload", {
          method: "POST",
          body,
          headers: {
            Cookie: cookie,
            "Content-Type": "image/png",
            "Content-Length": String(body.length),
            "X-Support-Filename": "screen.png",
            "X-Support-Ticket": id,
          },
        });

        await expect(action(actionArgs(request))).rejects.toThrow("pending_uploads");
      });

      expect(report).toHaveBeenCalledWith(JSON.stringify({
        event: "support.upload_staging_cleanup_failed",
        error: "cleanup unavailable",
      }));
    } finally {
      deleteObject.mockRestore();
      report.mockRestore();
    }
  });
});
