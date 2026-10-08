import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { formatDateTime } from "./format";
import { TimeZoneProvider, useTimeZone } from "./useTimeZone";

const INSTANT = Date.UTC(2026, 9, 8, 23, 30);

function SubmittedAt() {
  const timeZone = useTimeZone();
  return <time>{formatDateTime("en", INSTANT, timeZone)}</time>;
}

// The server renders in UTC and the visitor's browser in their own zone. React compares the two renders text for text and
// throws the server markup away on a difference (hydration error #418), so the output must come from the provided zone and
// never from the host. (The host zone itself cannot be changed inside workerd; `format.test.ts` covers zone determinism.)
describe("a date rendered through the time zone provider", () => {
  it("prints the shop's zone, not the host's", () => {
    const html = renderToString(<TimeZoneProvider value="Asia/Ho_Chi_Minh"><SubmittedAt /></TimeZoneProvider>);
    expect(html).toContain("Oct 9, 2026, 6:30 AM");
    const other = renderToString(<TimeZoneProvider value="America/Chicago"><SubmittedAt /></TimeZoneProvider>);
    expect(other).toContain("Oct 8, 2026, 6:30 PM");
  });

  it("falls back to UTC when nothing provides a zone", () => {
    expect(renderToString(<SubmittedAt />)).toContain("Oct 8, 2026, 11:30 PM");
  });
});
