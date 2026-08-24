import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

/**
 * Give each test a clean database.
 *
 * `applyD1Migrations` only applies migrations that have not run yet, so on its
 * own it does NOT reset data — rows written by one test survive into the next.
 * That makes tests order-dependent and produces confusing failures (a fixture
 * insert failing with "already exists"), so this also clears every table.
 *
 * D1 has no TRUNCATE, and the table list is read from the schema rather than
 * hardcoded, so a new table is covered automatically.
 */
export function setupTestDatabase() {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, JSON.parse(env.TEST_MIGRATIONS));

    const { results } = await env.DB.prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table'
         AND name NOT LIKE 'sqlite_%'
         AND name NOT LIKE '_cf_%'
         AND name <> 'd1_migrations'`,
    ).all<{ name: string }>();

    // Deliberately sequential: D1's batch API and foreign keys make ordering
    // matter, and a handful of DELETEs on empty tables is not a bottleneck.
    for (const { name } of results) {
      // The name comes from sqlite_master, not from user input.
      await env.DB.prepare(`DELETE FROM "${name}"`).run();
    }
  });
}
