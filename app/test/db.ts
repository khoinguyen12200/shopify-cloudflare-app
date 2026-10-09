import { and, eq, ne, notLike } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { makeDb } from "~/db/client";
import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";
import { z } from "zod";

/** The shape `readD1Migrations` hands to workerd, parsed rather than cast. */
const migrationsSchema = z.array(z.object({ name: z.string(), queries: z.array(z.string()) }));

/** Application tables in catalog (creation) order. */
async function listApplicationTables(db: D1Database): Promise<string[]> {
  const catalog = sqliteTable("sqlite_master", {
    name: text().notNull(),
    type: text().notNull(),
  });
  const rows = await makeDb(db).select({ name: catalog.name }).from(catalog).where(and(
    eq(catalog.type, "table"),
    notLike(catalog.name, "sqlite_%"),
    notLike(catalog.name, "_cf_%"),
    ne(catalog.name, "d1_migrations"),
  ));
  return rows.map((row) => row.name);
}

/**
 * Delete every row of `tables` in ONE D1 round trip.
 *
 * Tables are walked in reverse catalog creation order, so fixture children go
 * ahead of the parents they reference, and a D1 batch runs its statements in
 * order inside one transaction.
 */
async function deleteAllRows(db: D1Database, tables: readonly string[]): Promise<void> {
  const [first, ...rest] = [...tables].reverse().map((name) => makeDb(db).delete(sqliteTable(name, {})));
  if (first === undefined) return;
  await makeDb(db).batch([first, ...rest]);
}

/**
 * Empty every application table in `db`.
 *
 * The table list is read from the schema rather than hardcoded, so a new table
 * is covered automatically.
 */
export async function clearAllTables(db: D1Database): Promise<void> {
  await deleteAllRows(db, await listApplicationTables(db));
}

let cachedMigrations: Parameters<typeof applyD1Migrations>[1] | null = null;
function getMigrations(): Parameters<typeof applyD1Migrations>[1] {
  if (!cachedMigrations) {
    cachedMigrations = migrationsSchema.parse(JSON.parse(env.TEST_MIGRATIONS));
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
  // The table list cannot change between tests of one file (migrations run
  // once), so it is read once and every later reset is a single batch.
  let tables: readonly string[] | null = null;
  beforeEach(async () => {
    await ensureMigrated(env.DB);
    tables ??= await listApplicationTables(env.DB);
    await deleteAllRows(env.DB, tables);
  });
}
