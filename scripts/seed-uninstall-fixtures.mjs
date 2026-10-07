#!/usr/bin/env node
// Seed sample uninstall events into local D1 database for dashboard preview.
import { spawnSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DATABASE = "app-db";

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const sampleShops = [
  {
    shop: "tokyo-vintage.myshopify.com",
    name: "Tokyo Vintage Apparel",
    installedAt: now - 90 * day,
    uninstalledAt: now - 5 * day,
    shopifyShopId: "gid://shopify/Shop/101",
    eventId: "gid://partners/Relationship/mock-001",
    reason: "NOT_USING_APP",
    reasonDescription: "We shifted our business model and no longer need this feature.",
  },
  {
    shop: "nordic-crafts.myshopify.com",
    name: "Nordic Crafts Co.",
    installedAt: now - 120 * day,
    uninstalledAt: now - 15 * day,
    shopifyShopId: "gid://shopify/Shop/102",
    eventId: "gid://partners/Relationship/mock-002",
    reason: "TOO_EXPENSIVE",
    reasonDescription: "Great app, but we are cutting monthly recurring software costs.",
  },
  {
    shop: "summit-outdoors.myshopify.com",
    name: "Summit Outdoors",
    installedAt: now - 60 * day,
    uninstalledAt: now - 22 * day,
    shopifyShopId: "gid://shopify/Shop/103",
    eventId: "gid://partners/Relationship/mock-003",
    reason: "MISSING_FEATURES",
    reasonDescription: "Need multi-location inventory support before we can continue using this.",
  },
  {
    shop: "coastal-flora.myshopify.com",
    name: "Coastal Flora",
    installedAt: now - 45 * day,
    uninstalledAt: now - 30 * day,
    shopifyShopId: "gid://shopify/Shop/104",
    eventId: "gid://partners/Relationship/mock-004",
    reason: "DIDNT_NEED_IT",
    reasonDescription: null,
  },
];

const statements = [];

for (const s of sampleShops) {
  statements.push(`
    INSERT INTO shops (shop, name, relationship_status, installed_at, uninstalled_at, shopify_shop_id, is_dev_store)
    VALUES ('${s.shop}', '${s.name}', 'UNINSTALLED', ${s.installedAt}, ${s.uninstalledAt}, '${s.shopifyShopId}', 0)
    ON CONFLICT(shop) DO UPDATE SET
      name = excluded.name,
      relationship_status = excluded.relationship_status,
      uninstalled_at = excluded.uninstalled_at;
  `);

  statements.push(`
    INSERT INTO shopify_events (source, event_id, event_type, shop, shopify_shop_id, occurred_at, synchronized_at)
    VALUES ('partner_history', '${s.eventId}', 'UNINSTALLED', '${s.shop}', '${s.shopifyShopId}', ${s.uninstalledAt}, ${now})
    ON CONFLICT(source, event_id) DO NOTHING;
  `);

  const descVal = s.reasonDescription ? `'${s.reasonDescription.replace(/'/g, "''")}'` : "NULL";
  statements.push(`
    INSERT INTO shopify_relationship_events (event_source, event_id, reason, reason_description)
    VALUES ('partner_history', '${s.eventId}', '${s.reason}', ${descVal})
    ON CONFLICT(event_source, event_id) DO NOTHING;
  `);
}

const tempFile = join(tmpdir(), `seed-uninstalls-${Date.now()}.sql`);
try {
  writeFileSync(tempFile, statements.join("\n"), "utf8");
  const result = spawnSync("npx", ["wrangler", "d1", "execute", DATABASE, "--local", `--file=${tempFile}`], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  rmSync(tempFile, { force: true });
}

console.log("Successfully seeded sample uninstall fixtures into local database.");
