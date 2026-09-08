import { currentAppInstallationIdentitySchema } from "~/schemas/current-app-installation";

export const CURRENT_APP_IDENTITY_QUERY = `#graphql
  query CurrentAppIdentity {
    currentAppInstallation {
      app { id apiKey handle }
    }
  }
`;

export type ShopifyAppIdentity = { readonly id: string; readonly apiKey: string; readonly handle: string };

export class ShopifyAppIdentityAdapter {
  constructor(private readonly dependencies: {
    readonly graphql: (query: string) => Promise<Response>;
    readonly expectedApiKey: string | null;
    readonly expectedAppId: string | null;
  }) {}

  async current(): Promise<ShopifyAppIdentity> {
    const response = await this.dependencies.graphql(CURRENT_APP_IDENTITY_QUERY);
    if (!response.ok) throw new Error(`Shopify Admin identity query failed with HTTP ${response.status}`);
    const payload: unknown = await response.json();
    const body = payload !== null && typeof payload === "object" ? payload : null;
    const errors = body && "errors" in body && Array.isArray(body.errors) ? body.errors : [];
    if (errors.length > 0) throw new Error("Shopify Admin identity query returned GraphQL errors");
    const parsed = currentAppInstallationIdentitySchema.safeParse(payload);
    if (!parsed.success) throw new Error("Shopify Admin identity response was invalid");
    const identity = parsed.data.data.currentAppInstallation.app;
    if ((this.dependencies.expectedApiKey !== null && identity.apiKey !== this.dependencies.expectedApiKey)
      || (this.dependencies.expectedAppId !== null && identity.id !== this.dependencies.expectedAppId)) {
      throw new Error("Authenticated Shopify app does not match configured app identity");
    }
    return identity;
  }
}
