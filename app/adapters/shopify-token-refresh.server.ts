import type { Session } from "@shopify/shopify-api";
import { z } from "zod";
import type { ShopTokenRefresher, TokenRefreshOutcome } from "~/ports/token-refresh";

/** The slice of `SessionStorage` the refresh needs; `KVSessionStorage` implements it. */
export interface RefreshSessionStore {
  findSessionsByShop(shop: string): Promise<Session[]>;
  loadSession(id: string): Promise<Session | undefined>;
  storeSession(session: Session): Promise<boolean>;
}

export interface ShopifyTokenRefreshConfig {
  readonly sessions: RefreshSessionStore;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly fetch: typeof fetch;
  /** An access token valid for longer than this is left alone. */
  readonly freshForMs: number;
  readonly timeoutMs: number;
}

const SHOP_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-_]*\.myshopify\.com$/;

/** https://shopify.dev/docs/apps/build/authentication-authorization/implement-token-exchange — "Refresh an expiring offline token". */
const refreshResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1),
  refresh_token_expires_in: z.number().positive(),
  scope: z.string(),
});

const rejection = z.object({ error: z.string() });

/**
 * Our OWN call to the shop's token endpoint, for the periodic reconciliation Shopify tells apps to run because
 * webhooks are not guaranteed (a missed `app/uninstalled` otherwise leaves the shop installed forever). Not the
 * library's refresh: that reports every failure as a bare 500, so it cannot tell a dead pair from a flaky network.
 *
 * What this does NOT protect against: KV has no compare-and-set, so between the final read of the stored session
 * and `storeSession` a merchant visit could still store a newer pair that this write then replaces. The probe only
 * touches sessions whose access token has already expired (nobody is mid-request), re-reads immediately before the
 * write, and never overwrites a pair that changed — which narrows that window to a few milliseconds, not to zero.
 */
export class ShopifyTokenRefresh implements ShopTokenRefresher {
  constructor(private readonly config: ShopifyTokenRefreshConfig) {}

  async refresh(shop: string, now: number): Promise<TokenRefreshOutcome> {
    if (!SHOP_DOMAIN.test(shop)) return { kind: "unexpected", detail: "invalid_shop_domain" };
    const sessions = await this.config.sessions.findSessionsByShop(shop);
    const session = sessions.find((candidate) => !candidate.isOnline && candidate.refreshToken);
    const presented = session?.refreshToken;
    if (!session || !presented) return { kind: "no_session" };
    if (session.expires && session.expires.getTime() - now > this.config.freshForMs) return { kind: "fresh" };

    const response = await this.post(shop, presented);
    if ("kind" in response) return response;

    if (response.ok) return this.storeRefreshed(session, presented, await response.json(), now);
    if (response.status === 429 || response.status >= 500) return { kind: "transient", detail: `http_${response.status}` };
    if (response.status === 401 && (await readError(response)) === "invalid_request") {
      return (await this.pairChanged(session.id, presented)) ? { kind: "superseded" } : { kind: "terminal" };
    }
    return { kind: "unexpected", detail: `http_${response.status}` };
  }

  private async post(shop: string, refreshToken: string): Promise<Response | TokenRefreshOutcome> {
    // Called as a bare function: a Workers `fetch` invoked as a method of another object throws "Illegal invocation".
    const send = this.config.fetch;
    try {
      return await send(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });
    } catch (error) {
      return { kind: "transient", detail: error instanceof Error ? error.name : "network_error" };
    }
  }

  private async storeRefreshed(session: Session, presented: string, body: unknown, now: number): Promise<TokenRefreshOutcome> {
    const parsed = refreshResponse.safeParse(body);
    if (!parsed.success) return { kind: "unexpected", detail: "malformed_refresh_response" };
    // Re-read immediately before writing: never replace a pair somebody else stored while we were on the wire.
    if (await this.pairChanged(session.id, presented)) return { kind: "superseded" };
    session.accessToken = parsed.data.access_token;
    session.expires = new Date(now + parsed.data.expires_in * 1000);
    session.refreshToken = parsed.data.refresh_token;
    session.refreshTokenExpires = new Date(now + parsed.data.refresh_token_expires_in * 1000);
    session.scope = parsed.data.scope;
    await this.config.sessions.storeSession(session);
    return { kind: "refreshed" };
  }

  /** True when the stored session is gone or holds a different refresh token than the one we presented. */
  private async pairChanged(sessionId: string, presented: string): Promise<boolean> {
    const stored = await this.config.sessions.loadSession(sessionId);
    return stored?.refreshToken !== presented;
  }
}

async function readError(response: Response): Promise<string | null> {
  try {
    const parsed = rejection.safeParse(await response.json());
    return parsed.success ? parsed.data.error : null;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}
