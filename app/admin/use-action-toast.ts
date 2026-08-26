import { useEffect, useRef } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { resolveToast, type ActionMessage } from "~/lib/action-feedback";

/**
 * Pops a Shopify admin toast for the embedded app's own convention: every
 * create/update action gets one (@rules/polaris-app-home.md §5a).
 *
 * The same shape as the internal console's `~/internal/use-action-toast`, and
 * deliberately sharing its decision function — the two surfaces have different
 * toast implementations (App Bridge here, Sonner there) but the same rule about
 * when a toast is owed, and that rule is unit-tested once.
 *
 * `actionData` is `useActionData()`'s return value: a new object identity per
 * completed submission, so the effect fires exactly once per action result and
 * not on every re-render. `message` is read from a ref rather than listed as a
 * dependency, so a re-render that merely recomputes the same translated strings
 * into a new object never re-fires the toast.
 *
 * The toast is an ADDITION, never the only report of a failure: the page still
 * renders its authoritative error inline, because a toast is transient and easy
 * to miss.
 *
 * Verified by hand per @rules/testing.md — App Bridge's toast is host chrome
 * outside the document, not something a unit test can observe. `resolveToast`
 * carries the actual decision and IS unit-tested (`~/lib/action-feedback.test.ts`).
 */
export function useActionToast(actionData: unknown, message: ActionMessage) {
  const shopify = useAppBridge();
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
    shopify.toast.show(resolved.message, { isError: resolved.tone === "error" });
  }, [actionData, shopify]);
}
