import { useEffect } from "react";
import { useNavigation } from "react-router";

/**
 * Mirrors React Router's navigation state into the Shopify admin's own loading
 * bar (the Loading API), so the merchant sees progress while a navigation or an
 * action waits on the server, instead of a frozen page.
 *
 * The API "persists until it is explicitly stopped" and does not count
 * concurrent callers, so this is mounted ONCE (the /app layout) and every start
 * is paired with its stop by the effect's cleanup. The cleanup runs when the
 * navigation settles AND when the layout unmounts, so a navigation that is
 * interrupted or errors cannot leave the bar stuck on.
 *
 * Streamed regions are not navigations: `useNavigation` goes idle as soon as the
 * loader returns, and the region's own spinner covers the rest.
 *
 * Verified by hand per @rules/testing.md — the bar is host chrome outside the
 * document. Wiring only; the pairing is covered by `use-navigation-loading.dom.test.tsx`.
 */
export function useNavigationLoading(): void {
  const busy = useNavigation().state !== "idle";

  useEffect(() => {
    if (!busy) return;
    globalThis.shopify.loading(true);
    return () => {
      globalThis.shopify.loading(false);
    };
  }, [busy]);
}
