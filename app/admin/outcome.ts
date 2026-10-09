import type { Result } from "~/lib/result";

/**
 * What a streamed loader region hands the component: the value, or the one
 * reason it is missing. A region's data is awaited on the server by
 * `settle()`, which turns a rejection into `{ ok: false }`, so a component
 * never sees a thrown rejection and never has to guess at an error shape (an
 * `Error` does not survive the loader's serialisation anyway).
 */
export type Outcome<T> = Result<T, "failed">;
