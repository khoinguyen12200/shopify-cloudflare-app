/**
 * The three ambient facts a decision may need: the time, a fresh id, and random
 * bytes. They are ports so rings 1-3 never read them from the runtime
 * (@rules/code-craft.md: time, randomness, ids and env are parameters). The real
 * implementation lives in `app/adapters/system-runtime.ts`, bound only in
 * `app/wiring.server.ts`; fakes live in `app/test/fake-runtime.ts`.
 */
export interface Clock {
  /** Epoch milliseconds. */
  readonly now: () => number;
}

export interface Ids {
  /** A fresh, unique identifier. */
  readonly uuid: () => string;
}

/** `length` cryptographically random bytes. */
export type RandomBytes = (length: number) => Uint8Array<ArrayBuffer>;

export interface Runtime {
  readonly clock: Clock;
  readonly ids: Ids;
  readonly randomBytes: RandomBytes;
}
