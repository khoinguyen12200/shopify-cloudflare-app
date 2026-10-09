import { and, count, desc, eq, gt, isNull, lte } from "drizzle-orm";
import { getDb } from "~/request-context.server";
import {
  shopPlanGrants,
  type NewShopPlanGrant,
  type ShopPlanGrant,
} from "~/db/schema/plan-grants";
import type { PlanGrantsPort } from "~/ports/plan-grants";

export class PlanGrantsRepo implements PlanGrantsPort {
  async findActiveGrant(shop: string, now: number): Promise<ShopPlanGrant | null> {
    const rows = await getDb()
      .select()
      .from(shopPlanGrants)
      .where(
        and(
          eq(shopPlanGrants.shop, shop),
          lte(shopPlanGrants.startsAt, now),
          gt(shopPlanGrants.expiresAt, now),
          isNull(shopPlanGrants.revokedAt),
        ),
      )
      .orderBy(desc(shopPlanGrants.expiresAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async listGrantsForShop(shop: string): Promise<ShopPlanGrant[]> {
    return getDb()
      .select()
      .from(shopPlanGrants)
      .where(eq(shopPlanGrants.shop, shop))
      .orderBy(desc(shopPlanGrants.createdAt));
  }

  async countActiveGrants(now: number): Promise<number> {
    const [row] = await getDb()
      .select({ count: count() })
      .from(shopPlanGrants)
      .where(
        and(
          lte(shopPlanGrants.startsAt, now),
          gt(shopPlanGrants.expiresAt, now),
          isNull(shopPlanGrants.revokedAt),
        ),
      );
    return Number(row?.count ?? 0);
  }

  async createGrant(grant: NewShopPlanGrant): Promise<ShopPlanGrant> {
    const [row] = await getDb()
      .insert(shopPlanGrants)
      .values(grant)
      .returning();
    if (!row) throw new Error("Failed to insert plan grant");
    return row;
  }

  async revokeGrant(shop: string, grantId: string, revokedBy: string, now: number): Promise<boolean> {
    const updated = await getDb()
      .update(shopPlanGrants)
      .set({
        revokedAt: now,
        revokedBy,
      })
      .where(
        and(
          eq(shopPlanGrants.shop, shop),
          eq(shopPlanGrants.id, grantId),
          isNull(shopPlanGrants.revokedAt),
        ),
      )
      .returning();
    return updated.length > 0;
  }
}
