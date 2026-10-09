import { systemRuntime } from "~/adapters/system-runtime";
import type { Runtime } from "~/ports/runtime";
import { getEnv } from "~/request-context.server";

/** The clock, id source and CSPRNG every use case receives. Bound here and nowhere else. */
export function appRuntime(): Runtime {
  return systemRuntime;
}

/** What the staff support operations read from the outside world. */
export function appContext(): { readonly env: Env; readonly runtime: Runtime } {
  return { env: getEnv(), runtime: appRuntime() };
}
