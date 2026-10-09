/**
 * The Worker entry the test pool boots instead of `workers/app.ts`.
 *
 * Tests import the code they exercise directly, and none of them goes through
 * the Worker's own `fetch`. Booting the real entry would load the entire
 * app (React Router server build, email rendering, the UI library) into every
 * test file's isolate, which costs seconds per file for nothing.
 */
export default {
  fetch(): Response {
    return new Response("test worker entry: tests import the code under test directly", { status: 501 });
  },
} satisfies ExportedHandler;
