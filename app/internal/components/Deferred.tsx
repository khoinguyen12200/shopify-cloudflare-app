import { Suspense, type ReactNode } from "react";
import { Await } from "react-router";
import { Card } from "ngk-dashboard";

/**
 * A region that failed to load. It says so, rather than showing a plausible
 * empty value or zero: a number the page cannot be correct without must never be
 * quietly replaced by a wrong one.
 */
export function RegionError({ title }: { title: string }) {
  return (
    <Card>
      <div role="alert" className="p-6 text-sm text-muted-foreground">
        {title} could not be loaded. Reload the page to try again.
      </div>
    </Card>
  );
}

interface DeferredProps<T> {
  /** The un-awaited promise the loader returned (see `streamRegion`). */
  readonly resolve: Promise<T>;
  /** Shaped like the final content, so nothing jumps when data arrives. */
  readonly fallback: ReactNode;
  /** Names the region in its error state. */
  readonly errorTitle: string;
  /**
   * Identifies WHICH record the region shows. Navigating between two records of
   * the same route would otherwise keep the previous record on screen (a
   * transition never re-shows an already-revealed fallback); a new key mounts a
   * fresh boundary, so the skeleton appears instead.
   */
  readonly resetKey?: string;
  readonly children: (value: T) => ReactNode;
}

/**
 * Suspense + Await + a region error, in one place so every internal page
 * streams the same way. After an action, React Router revalidates and hands a
 * NEW promise to the SAME boundary; the router update is a transition, so the
 * already-visible data stays up until the fresh data lands instead of flashing
 * the skeleton.
 */
export function Deferred<T>({ resolve, fallback, errorTitle, resetKey, children }: DeferredProps<T>) {
  return (
    <Suspense key={resetKey} fallback={fallback}>
      <Await resolve={resolve} errorElement={<RegionError title={errorTitle} />}>
        {children}
      </Await>
    </Suspense>
  );
}
