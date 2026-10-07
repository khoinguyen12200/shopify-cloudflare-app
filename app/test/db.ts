import { and, eq, ne, notLike } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { makeDb } from "~/db/client";
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

/**
 * Empty every application table in `db`.
 *
 * The table list is read from the schema rather than hardcoded, so a new table
 * is covered automatically.
 */
export async function clearAllTables(db: D1Database): Promise<void> {
  const catalog = sqliteTable("sqlite_master", {
    name: text().notNull(),
    type: text().notNull(),
  });
  const client = makeDb(db);
  const tables = await client.select({ name: catalog.name }).from(catalog).where(and(
    eq(catalog.type, "table"),
    notLike(catalog.name, "sqlite_%"),
    notLike(catalog.name, "_cf_%"),
    ne(catalog.name, "d1_migrations"),
  ));

  // Reverse catalog creation order keeps fixture children ahead of parents.
  for (const { name } of tables.reverse()) {
    await client.delete(sqliteTable(name, {}));
  }

}

let cachedMigrations: Parameters<typeof applyD1Migrations>[1] | null = null;
function getMigrations(): Parameters<typeof applyD1Migrations>[1] {
  if (!cachedMigrations) {
    cachedMigrations = JSON.parse(env.TEST_MIGRATIONS) as Parameters<typeof applyD1Migrations>[1];
  }
  return cachedMigrations;
}

let isMigrated = false;

async function ensureMigrated(db: D1Database): Promise<void> {
  if (!isMigrated) {
    await applyD1Migrations(db, getMigrations());
    isMigrated = true;
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
    await ensureMigrated(env.DB);
    await clearAllTables(env.DB);
  });
}
