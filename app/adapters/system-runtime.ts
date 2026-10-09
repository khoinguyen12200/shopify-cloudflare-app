import type { Runtime } from "~/ports/runtime";

/**
 * The real clock, id source and CSPRNG. This is the ONLY place app code reads
 * them from the runtime; it is bound to the `Runtime` port in
 * `app/wiring.server.ts`. An immutable constant — no state to leak across shops.
 */
export const systemRuntime: Runtime = {
  clock: { now: () => Date.now() },
  ids: { uuid: () => crypto.randomUUID() },
  randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
};
