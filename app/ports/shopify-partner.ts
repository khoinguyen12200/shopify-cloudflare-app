export interface ShopifyPartnerPort {
  activeSubscription(appId: string, shopId: string): Promise<unknown | null>;
}
