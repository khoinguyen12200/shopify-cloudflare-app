import { AsyncLocalStorage } from "node:async_hooks";
import { makeDb, type Db } from "./db/client";

/**
 * Per-request context.
 *
 * workerd has no `process.env` — configuration and bindings arrive as the `env`
 * argument to the Worker's fetch handler. The Worker entry (workers/app.ts)
 * wraps every request in this AsyncLocalStorage store so server code reads env
 * via `getEnv()` and the Drizzle client via `getDb()`, with no argument
 * threading and no module-level state.
 *
 * Module-scope state would be a cross-tenant leak: one isolate is reused across
 * shops. The store is per-request, so it is safe.
 */
interface RequestContext {
  env: Env;
  db?: Db;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(env: Env, fn: () => T): T {
  return storage.run({ env }, fn);
}

export function getEnv(): Env {
  const store = storage.getStore();
  if (!store) {
    throw new Error("getEnv() called outside of a request context");
  }
  return store.env;
}

/** The only way app code obtains a DB handle. Memoized per request. */
export function getDb(): Db {
  const store = storage.getStore();
  if (!store) {
    throw new Error("getDb() called outside of a request context");
  }
  store.db ??= makeDb(store.env.DB);
  return store.db;
}
