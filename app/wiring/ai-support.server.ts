import { WorkersAiGenerator, workersAiModelFactory } from "~/adapters/workers-ai.server";
import { allowAll, type AiGate } from "~/ai/gate";
import type { TextGenerator } from "~/ports/ai";
import { getEnv } from "~/request-context.server";
import { AiService } from "~/services/ai.server";
import { SupportService } from "~/services/support.server";
import { signAttachmentToken } from "~/support/file-token";
import { adminUsers } from "~/wiring/admin.server";
import { queuedNotifier } from "~/wiring/notifications.server";
import { aiRepository, support } from "~/wiring/repositories.server";
import { appRuntime } from "~/wiring/runtime.server";

export function requireAttachmentTokenSecret(env: { readonly ATTACHMENT_TOKEN_SECRET?: string; readonly SHOPIFY_API_SECRET?: string }): string {
  if (!env.ATTACHMENT_TOKEN_SECRET) {
    throw new Error("ATTACHMENT_TOKEN_SECRET is not configured");
  }
  return env.ATTACHMENT_TOKEN_SECRET;
}

/**
 * THE COMPOSITION ROOT — the one place a port is bound to an adapter.
 *
 * It exists because @rules/architecture.md forbids ring 3 importing ring 4: a
 * use case declares a port and RECEIVES an implementation, it never names one.
 * `AiService` used to import the Workers AI adapter directly, which quietly made
 * the service impossible to run against anything else and dragged the provider
 * into every test that touched it.
 *
 * Everything an app is likely to change about AI is a line in this file:
 *
 *   - a different provider            → swap `aiGenerator`
 *   - a gating policy                 → `composeGates(...)` into `aiGate`
 *   - AI switched off entirely        → a generator that always refuses
 *
 * Built per REQUEST, not at module load: bindings arrive on the request `env`,
 * and a module-level instance would be shared across shops in a reused isolate
 * (@rules/architecture.md — no mutable module state).
 */

/** The text generator every AI use case runs on. */
export function aiGenerator(): TextGenerator {
  return new WorkersAiGenerator({ languageModel: workersAiModelFactory() });
}

export function aiService(): AiService {
  return new AiService({ repo: aiRepository(), generator: aiGenerator(), clock: appRuntime().clock, ids: appRuntime().ids, gate: aiGate() });
}

export function supportService(): SupportService {
  const env = getEnv();
  return new SupportService({
    repo: support(),
    admins: adminUsers(),
    clock: appRuntime().clock,
    notifier: queuedNotifier(),
    appUrl: env.SHOPIFY_APP_URL,
    withinRateLimit: async (shop) => env.SUPPORT_LIMITER ? (await env.SUPPORT_LIMITER.limit({ key: shop })).success : true,
    signAttachment: async (attachmentId, expiresAt) => signAttachmentToken({ secret: requireAttachmentTokenSecret(env), attachmentId, expiresAt }),
  });
}

/**
 * Who may use AI.
 *
 * `allowAll` in the base: a policy is the app's decision, not the base's. An
 * app returns `composeGates(...)` here — see `~/ai/gate` for the shape and a
 * worked plan-gating example. This is the ONLY file that has to change.
 */
export function aiGate(): AiGate {
  return allowAll;
}
