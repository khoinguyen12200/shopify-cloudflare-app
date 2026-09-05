import { vi } from "vitest";

vi.stubGlobal(
  "fetch",
  async () =>
    new Response("Outbound network is blocked in DOM tests. Fake this call at the HTTP boundary.", {
      status: 403,
    }),
);
