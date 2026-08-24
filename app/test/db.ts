import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

/**
 * Empty every application table in `db`.
 *
 * The table list is read from the schema rather than hardcoded, so a new table
 * is covered automatically.
 */
export async function clearAllTables(db: D1Database): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_cf_%'
         AND name <> 'd1_migrations'`,
    )
    .all<{ name: string }>();

  // REVERSE creation order, and deliberately sequential. A foreign key can
  // only point at a table that already existed, so `sqlite_master`'s creation
  // order always lists a child after its parent — deleting backwards clears the
  // child before the row it references. Forward order trips
  // SQLITE_CONSTRAINT_FOREIGNKEY on any relation that is not ON DELETE cascade.
  for (const { name } of results.reverse()) {
    // The name comes from sqlite_master, not from user input.
    await db.prepare(`DELETE FROM "${name}"`).run();
  }
}

/**
 * Give each test a clean database.
 *
 * `applyD1Migrations` only applies migrations that have not run yet, so on its
 * own it does NOT reset data — rows written by one test survive into the next.
 * That makes tests order-dependent and produces confusing failures (a fixture
 * insert failing with "already exists"), so this also clears every table.
 *
 * D1 has no TRUNCATE, hence the DELETEs.
 */
export function setupTestDatabase() {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, JSON.parse(env.TEST_MIGRATIONS));
    await clearAllTables(env.DB);
  });
}
