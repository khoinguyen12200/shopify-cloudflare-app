import { env, applyD1Migrations } from "cloudflare:test";
import { beforeEach } from "vitest";

/**
 * Re-apply the D1 migrations before each test so every test starts from a known
 * schema. The migrations arrive via the TEST_MIGRATIONS binding that
 * vitest.config.ts fills from ./drizzle.
 */
export function setupTestDatabase() {
  beforeEach(async () => {
    await applyD1Migrations(env.DB, JSON.parse(env.TEST_MIGRATIONS));
  });
}
