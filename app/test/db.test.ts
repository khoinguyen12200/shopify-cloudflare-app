import { env } from "cloudflare:test";
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
    await env.DB.exec("CREATE TABLE IF NOT EXISTS fk_parent (id TEXT PRIMARY KEY)");
    await env.DB.exec(
      "CREATE TABLE IF NOT EXISTS fk_child (id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES fk_parent(id))",
    );
  });

  afterEach(async () => {
    await env.DB.exec("DROP TABLE IF EXISTS fk_child");
    await env.DB.exec("DROP TABLE IF EXISTS fk_parent");
  });

  it("clears a child table before the parent row it references", async () => {
    await env.DB.prepare("INSERT INTO fk_parent (id) VALUES ('p')").run();
    await env.DB.prepare("INSERT INTO fk_child (id, parent_id) VALUES ('c', 'p')").run();

    await clearAllTables(env.DB);

    const parents = await env.DB.prepare("SELECT count(*) AS n FROM fk_parent").first<{
      n: number;
    }>();
    const children = await env.DB.prepare("SELECT count(*) AS n FROM fk_child").first<{
      n: number;
    }>();
    expect(children?.n).toBe(0);
    expect(parents?.n).toBe(0);
  });
});
