/**
 * What, if anything, a route should tell the user about its last form
 * submission. Pure derivation — the caller supplies already-translated text;
 * the toast/DOM side of showing it lives in `~/internal/use-action-toast`.
 */

export type ActionMessage = { success?: string; error?: string } | undefined;

export type ResolvedToast = { tone: "success" | "error"; message: string };

export function resolveToast(message: ActionMessage): ResolvedToast | null {
  if (message?.error) return { tone: "error", message: message.error };
  if (message?.success) return { tone: "success", message: message.success };
  return null;
}
