/**
 * Loader-side helper for every streamed region of an internal page. Server
 * only, so the `console` write never reaches the browser bundle.
 *
 * A console loader awaits ONE thing — the auth check — and hands every data
 * region back as a promise wrapped by this function. React Router then sends
 * the page frame at once and streams each region in behind its skeleton.
 */

/**
 * Hands a region's promise to React Router un-awaited, but records the failure
 * first. The rejection is re-thrown so `<Deferred>`'s error element renders the
 * region's error state: a failed region degrades on its own and never takes the
 * page (or another region) down with it.
 *
 * Only the error's NAME is logged. Database errors embed the failing statement
 * and its parameters, which can carry shop domains and staff emails.
 */
export function streamRegion<T>(route: string, region: string, pending: Promise<T>): Promise<T> {
  return pending.catch((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "internal.region_failed",
        route,
        region,
        errorName: error instanceof Error ? error.name : typeof error,
      }),
    );
    throw error;
  });
}
