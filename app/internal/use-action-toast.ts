import { useEffect, useRef } from "react";
import { toast } from "ngk-dashboard";
import { resolveToast, type ActionMessage } from "~/lib/action-feedback";

/**
 * Pops a toast for the console's own convention: every create/update action
 * gets one, layered on top of the page's inline `<Alert>` (which stays the
 * no-JS-safe, authoritative feedback — this is a client-side enhancement).
 *
 * `actionData` is `useActionData()`'s return value: a new object identity per
 * completed submission, so the effect fires exactly once per action result,
 * not on every re-render. `message` is read from a ref rather than listed as a
 * dependency so a re-render that merely recomputes the same translated string
 * (a new object, identical content) never re-fires the toast.
 *
 * Verified by hand per @rules/testing.md — a Sonner toast is a rendered
 * third-party component, not meaningfully unit-testable. `resolveToast` carries
 * the actual decision and IS unit-tested (`~/lib/action-feedback.test.ts`).
 */
export function useActionToast(actionData: unknown, message: ActionMessage) {
  const messageRef = useRef(message);

  // Runs after every render, before the effect below — refs are written
  // outside render, never during it.
  useEffect(() => {
    messageRef.current = message;
  });

  useEffect(() => {
    if (!actionData) return;
    const resolved = resolveToast(messageRef.current);
    if (!resolved) return;
    toast[resolved.tone](resolved.message);
  }, [actionData]);
}
