import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { shops } from "./shops";

export const shopPlanGrants = sqliteTable(
  "shop_plan_grants",
  {
    id: text("id").primaryKey(),
    shop: text("shop")
      .notNull()
      .references(() => shops.shop, { onDelete: "cascade" }),
    planHandle: text("plan_handle").notNull(),
    reason: text("reason").notNull(),
    grantedBy: text("granted_by").notNull(),
    startsAt: integer("starts_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    revokedBy: text("revoked_by"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("shop_plan_grants_shop_idx").on(table.shop),
    index("shop_plan_grants_lookup_idx").on(table.shop, table.expiresAt, table.revokedAt),
  ],
);

export type ShopPlanGrant = typeof shopPlanGrants.$inferSelect;
export type NewShopPlanGrant = typeof shopPlanGrants.$inferInsert;
