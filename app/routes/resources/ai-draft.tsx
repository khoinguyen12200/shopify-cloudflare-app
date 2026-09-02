import type { ActionFunctionArgs } from "react-router";
import { cloudflareContext } from "../../../workers/app";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers } from "~/wiring.server";
import { SupportService } from "~/services/support.server";
import { AiService } from "~/services/ai.server";
import type { ThreadForPrompt } from "~/ai/draft-prompt";
import { toReplyTone } from "~/ai/tones";
import { replyTask } from "~/ai/tasks/reply";

/**
 * Streams a REWRITE of what the staff member has already typed, token by token
 * — or a suggestion when the box is empty.
 *
 * A plain `text/plain` stream rather than the AI SDK's data-stream protocol:
 * the client is one textarea being filled in, not a chat transcript, so there
 * is nothing to encode beyond the text itself. That keeps the browser side to
 * a `fetch` and a reader, with no protocol to keep in step.
 *
 * STAFF ONLY, and the ticket is read through the staff-side lookup — a draft is
 * generated from a whole thread, so an endpoint that took its content from the
 * request body would let anyone who can reach it put words in the model's mouth
 * and bill us for the privilege.
 */
export const action = async ({ request, context }: ActionFunctionArgs) => {
  const staff = await requireAdminUser(request, { users: adminUsers() });
  if (!staff) return new Response("Not found", { status: 404 });

  const form = await request.formData();
  const ticketId = String(form.get("ticketId") ?? "");
  // What the staff member has already written, and how they want it to sound.
  // Both come off a form, so the tone is narrowed rather than trusted.
  const currentText = String(form.get("currentText") ?? "");
  const instruction = String(form.get("instruction") ?? "");
  const tone = toReplyTone(String(form.get("tone") ?? ""));

  const support = new SupportService();
  const found = await support.findForStaff(ticketId);
  if (!found) return new Response("Not found", { status: 404 });

  const thread: ThreadForPrompt = {
    subject: found.ticket.subject,
    shopName: found.ticket.shopName,
    category: found.ticket.category,
    messages: found.messages.map((message) => ({
      author: message.author,
      authorName: message.authorName,
      body: message.body,
    })),
  };

  const started = await new AiService().stream(
    replyTask,
    { thread, currentText, instruction, tone },
    // The staff console: our own tooling and our own spend, because the merchant
    // did not ask for this draft.
    { surface: "staff", shop: null },
  );

  if (!started.ok) {
    // A plain status the composer can turn into one sentence. Never a 500: not
    // having a draft is a degraded feature, not a broken page.
    return new Response(started.reason, { status: 503 });
  }

  // The ledger is settled AFTER the response is sent. `waitUntil` is what keeps
  // the isolate alive for it — a floating promise here would be cancelled the
  // moment the response returns, and the call would go unmetered.
  //
  // Never destructure `ctx` (@rules/cloudflare.md): it loses `this` and throws.
  const cloudflare = context.get(cloudflareContext);
  cloudflare.ctx.waitUntil(started.value.done);

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of started.value.textStream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch {
        // The draft stops where it stops. The staff member keeps what arrived
        // and writes the rest — never an error thrown into a half-filled box.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Nothing downstream should buffer a stream whose whole point is arriving early.
      "X-Accel-Buffering": "no",
    },
  });
};
