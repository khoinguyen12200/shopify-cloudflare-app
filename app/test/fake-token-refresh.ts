import type { ShopTokenRefresher, TokenRefreshOutcome } from "~/ports/token-refresh";

/** A scripted `ShopTokenRefresher`: answers per shop, records every call, and can run code mid-call. */
export class FakeTokenRefresher implements ShopTokenRefresher {
  readonly calls: { readonly shop: string; readonly now: number }[] = [];
  private active = 0;
  maxConcurrent = 0;

  constructor(
    private readonly outcomes: Readonly<Record<string, TokenRefreshOutcome | Error>>,
    private readonly during: (shop: string) => Promise<void> = async () => undefined,
  ) {}

  async refresh(shop: string, now: number): Promise<TokenRefreshOutcome> {
    this.calls.push({ shop, now });
    this.active += 1;
    this.maxConcurrent = Math.max(this.maxConcurrent, this.active);
    try {
      await this.during(shop);
      const outcome = this.outcomes[shop] ?? { kind: "refreshed" };
      if (outcome instanceof Error) throw outcome;
      return outcome;
    } finally {
      this.active -= 1;
    }
  }
}
