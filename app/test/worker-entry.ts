/**
 * The Worker entry the test pool boots instead of `workers/app.ts`.
 *
 * Tests import the code they exercise directly, and none of them goes through
 * the Worker's own `fetch`, `queue` or `scheduled`. Booting the real entry would
 * load the entire app (React Router server build, email rendering, the UI
 * library) into every test file's isolate, which costs seconds per file for
 * nothing.
 *
 * `queue` and `scheduled` exist only because wrangler.jsonc declares queue
 * consumers and crons: workerd warns when a Worker with a consumer has no
 * `queue()` handler. They do nothing; the real handlers are tested by importing
 * `workers/app.ts` directly (workers/app.test.ts).
 */
export default {
  fetch(): Response {
    return new Response("test worker entry: tests import the code under test directly", { status: 501 });
  },
  queue(): void {},
  scheduled(): void {},
} satisfies ExportedHandler;
