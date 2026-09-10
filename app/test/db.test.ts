import { count } from "drizzle-orm";
import { makeDb } from "~/db/client";
import { fkParent, fkChild } from "./cleanup-schema";
import { env, applyD1Migrations } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { clearAllTables } from "./db";

/**
 * The cleanup in `setupTestDatabase()` has to survive a plain foreign key.
 *
 * `sqlite_master` lists tables in CREATION order, and a child table can only be
 * created after the parent it references — so walking that list forward deletes
 * the parent first and trips the constraint. The scaffold's only foreign key is
 * `ON DELETE cascade`, which hides this, so the guard lives here instead of
 * waiting for the first real relation to break the whole suite.
 */
describe("clearAllTables", () => {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, JSON.parse(env.TEST_CLEANUP_MIGRATIONS).create);
  });

  afterEach(async () => {
    await applyD1Migrations(env.DB, JSON.parse(env.TEST_CLEANUP_MIGRATIONS).drop);
  });

  it("clears a child table before the parent row it references", async () => {
    const db = makeDb(env.DB);
    await db.insert(fkParent).values({ id: "p" });
    await db.insert(fkChild).values({ id: "c", parentId: "p" });

    await clearAllTables(env.DB);

    const parents = await db.select({ n: count() }).from(fkParent).get();
    const children = await db.select({ n: count() }).from(fkChild).get();
    expect(children?.n).toBe(0);
    expect(parents?.n).toBe(0);
  });
});
