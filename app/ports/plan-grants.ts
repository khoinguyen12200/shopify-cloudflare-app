import type { NewShopPlanGrant, ShopPlanGrant } from "~/db/schema/plan-grants";

export interface PlanGrantsPort {
  findActiveGrant(shop: string, now?: number): Promise<ShopPlanGrant | null>;
  listGrantsForShop(shop: string): Promise<ShopPlanGrant[]>;
  countActiveGrants(now?: number): Promise<number>;
  createGrant(grant: NewShopPlanGrant): Promise<ShopPlanGrant>;
  revokeGrant(shop: string, grantId: string, revokedBy: string, now?: number): Promise<boolean>;
}
