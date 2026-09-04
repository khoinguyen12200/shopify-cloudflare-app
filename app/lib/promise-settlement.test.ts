import { describe, expect, test } from "vitest";

import { onPromiseSettled } from "./promise-settlement";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

describe("onPromiseSettled", () => {
  test("calls cleanup after resolution", async () => {
    const pending = deferred<void>();
    let cleanupCalls = 0;

    onPromiseSettled(pending.promise, () => {
      cleanupCalls += 1;
    });

    pending.resolve();
    await pending.promise;
    await Promise.resolve();

    expect(cleanupCalls).toBe(1);
  });

  test("calls cleanup after rejection", async () => {
    const pending = deferred<void>();
    let cleanupCalls = 0;

    onPromiseSettled(pending.promise, () => {
      cleanupCalls += 1;
    });

    pending.reject(new Error("render failed"));
    await expect(pending.promise).rejects.toThrow("render failed");
    await Promise.resolve();

    expect(cleanupCalls).toBe(1);
  });
});
