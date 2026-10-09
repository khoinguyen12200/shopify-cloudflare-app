import type { Clock, Ids, RandomBytes, Runtime } from "~/ports/runtime";

/** A clock that only moves when the test says so. */
export interface FakeClock extends Clock {
  advance(ms: number): void;
  set(at: number): void;
}

export function fakeClock(start = 1_700_000_000_000): FakeClock {
  let current = start;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
    set: (at) => {
      current = at;
    },
  };
}

/** Ids `prefix-1`, `prefix-2`, ... in call order. */
export function sequentialIds(prefix = "id"): Ids {
  let counter = 0;
  return {
    uuid: () => {
      counter += 1;
      return `${prefix}-${counter}`;
    },
  };
}

/** Deterministic bytes: every call continues a counter, so no two calls repeat. */
export function sequentialRandomBytes(seed = 1): RandomBytes {
  let next = seed;
  return (length) => {
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = next % 256;
      next = (next * 31 + 7) % 65_521;
    }
    return bytes;
  };
}

export interface FakeRuntime extends Runtime {
  readonly clock: FakeClock;
}

export function fakeRuntime(options: { readonly start?: number; readonly idPrefix?: string; readonly seed?: number } = {}): FakeRuntime {
  return {
    clock: fakeClock(options.start),
    ids: sequentialIds(options.idPrefix),
    randomBytes: sequentialRandomBytes(options.seed),
  };
}

/**
 * Shared, process-wide fakes for tests that build several repositories and only
 * need ids to be unique and the clock to be fixed. Tests that assert on a
 * specific id or time build their own with `fakeRuntime()`.
 */
export const testIds: Ids = sequentialIds("test");
export const testRandomBytes: RandomBytes = sequentialRandomBytes();
