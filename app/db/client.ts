import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Drizzle client over a D1 binding.
 *
 * `casing: "snake_case"` must match drizzle.config.ts, or generated migrations
 * and runtime queries disagree on column names.
 */
export function makeDb(d1: D1Database) {
  return drizzle(d1, { schema, casing: "snake_case" });
}

export type Db = ReturnType<typeof makeDb>;
