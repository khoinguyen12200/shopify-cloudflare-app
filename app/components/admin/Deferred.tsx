import { Suspense, type ReactNode } from "react";
import { Await } from "react-router";

import type { Outcome } from "~/admin/outcome";

type DeferredProps<T> = {
  /** A loader region already passed through `settle()`. */
  readonly resolve: Promise<Outcome<T>>;
  /** Shown while the region is pending. */
  readonly pending: ReactNode;
  /** Shown when the region failed, on the server (`ok: false`) or in transit (stream timeout). */
  readonly failed: ReactNode;
  readonly children: (value: T) => ReactNode;
};

/**
 * One streamed region of a page: pending UI, then the value, or the failure.
 *
 * `errorElement` covers the one rejection `settle()` cannot prevent: the
 * loader stream is cut off by `streamTimeout`, which rejects every promise
 * still pending in the browser. The merchant sees the same failure UI either way.
 *
 * Renders no wrapper element, so `s-section` children stay direct children of
 * `s-page`, which is what lets the page space them.
 */
export function Deferred<T>({ resolve, pending, failed, children }: DeferredProps<T>) {
  return (
    <Suspense fallback={pending}>
      <Await resolve={resolve} errorElement={failed}>
        {(outcome) => (outcome.ok ? children(outcome.value) : failed)}
      </Await>
    </Suspense>
  );
}

type PendingSectionProps = {
  /** Translated name of what is loading; announced by assistive technology. */
  readonly label: string;
  readonly heading?: string;
};

/**
 * Loading feedback for one pending region: a real `s-section` holding a
 * labelled `s-spinner`, per Shopify's guidance (Polaris web components have no
 * skeleton). The padding gives the region a stable footprint so the content
 * replacing it moves the rest of the page as little as possible.
 */
export function PendingSection({ label, heading }: PendingSectionProps) {
  return (
    <s-section heading={heading} accessibilityLabel={label}>
      <s-stack direction="block" alignItems="center" padding="large">
        <s-spinner size="large" accessibilityLabel={label} />
      </s-stack>
    </s-section>
  );
}

type FailedSectionProps = {
  readonly heading: string;
  readonly body: string;
};

/** The region's failure, in place of the value it could not show. The rest of the page is untouched. */
export function FailedSection({ heading, body }: FailedSectionProps) {
  return (
    <s-section>
      <s-banner tone="critical" heading={heading}>
        <s-paragraph>{body}</s-paragraph>
      </s-banner>
    </s-section>
  );
}
