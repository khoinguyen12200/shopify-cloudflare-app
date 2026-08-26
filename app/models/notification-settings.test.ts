import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import { runWithRequestContext } from "~/request-context.server";
import { setupTestDatabase } from "~/test/db";
import {
  GLOBAL_SCOPE,
  NotificationSettingsRepo,
  normalizeAddress,
} from "./notification-settings.server";

setupTestDatabase();

const inRequest = <T>(fn: () => Promise<T>) => runWithRequestContext(env, fn);
const SHOP = "acme.myshopify.com";
const NOW = 1_700_000_000_000;

describe("selection: absent is not empty", () => {
  it("omits an event with no rows, so it means 'no preference'", async () => {
    const selection = await inRequest(() =>
      new NotificationSettingsRepo().selection(SHOP),
    );
    // Not `{ admin_password_reset: [] }` — that would be an explicit "none", and
    // the eligibility rules treat the two differently.
    expect(selection.admin_password_reset).toBeUndefined();
  });

  it("returns an EMPTY array once a row exists but is disabled", async () => {
    const selection = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.setPreference({
        scope: SHOP,
        event: "admin_password_reset",
        channel: "email",
        enabled: false,
        now: NOW,
      });
      return repo.selection(SHOP);
    });
    expect(selection.admin_password_reset).toEqual([]);
  });

  it("returns the enabled channels", async () => {
    const selection = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.setPreference({
        scope: SHOP,
        event: "admin_password_reset",
        channel: "email",
        enabled: true,
        now: NOW,
      });
      return repo.selection(SHOP);
    });
    expect(selection.admin_password_reset).toEqual(["email"]);
  });
});

describe("scope precedence", () => {
  it("lets a tenant row override the global default", async () => {
    const selection = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.setPreference({
        scope: GLOBAL_SCOPE,
        event: "admin_password_reset",
        channel: "email",
        enabled: true,
        now: NOW,
      });
      await repo.setPreference({
        scope: SHOP,
        event: "admin_password_reset",
        channel: "email",
        enabled: false,
        now: NOW,
      });
      return repo.selection(SHOP);
    });
    expect(selection.admin_password_reset).toEqual([]);
  });

  it("falls back to the global row for a tenant with none of its own", async () => {
    const selection = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.setPreference({
        scope: GLOBAL_SCOPE,
        event: "admin_password_reset",
        channel: "email",
        enabled: true,
        now: NOW,
      });
      return repo.selection("other.myshopify.com");
    });
    expect(selection.admin_password_reset).toEqual(["email"]);
  });

  it("does not leak one tenant's preference into another", async () => {
    const other = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.setPreference({
        scope: SHOP,
        event: "admin_password_reset",
        channel: "email",
        enabled: false,
        now: NOW,
      });
      return repo.selection("other.myshopify.com");
    });
    expect(other.admin_password_reset).toBeUndefined();
  });
});

describe("setPreference is idempotent", () => {
  it("updates rather than duplicating", async () => {
    const selection = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      for (const enabled of [true, false, true]) {
        await repo.setPreference({
          scope: SHOP,
          event: "admin_password_reset",
          channel: "email",
          enabled,
          now: NOW,
        });
      }
      return repo.selection(SHOP);
    });
    expect(selection.admin_password_reset).toEqual(["email"]);
  });
});

describe("clearPreference returns to 'no preference'", () => {
  it("removes the rows rather than storing everything off", async () => {
    // Those are different states, and the difference decides whether the event
    // falls back to its default or is explicitly silenced.
    const selection = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.setPreference({
        scope: SHOP,
        event: "admin_password_reset",
        channel: "email",
        enabled: false,
        now: NOW,
      });
      await repo.clearPreference(SHOP, "admin_password_reset");
      return repo.selection(SHOP);
    });
    expect(selection.admin_password_reset).toBeUndefined();
  });
});

describe("opt-outs are keyed on the ADDRESS", () => {
  it("records and reports one", async () => {
    const channels = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: SHOP,
        channel: "email",
        address: "stop@example.org",
        source: "unsubscribe_link",
        now: NOW,
      });
      return repo.optedOutChannels(SHOP, { email: "stop@example.org" });
    });
    expect(channels).toEqual(["email"]);
  });

  it("matches case-insensitively, so an opt-out cannot be sidestepped", async () => {
    const channels = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: SHOP,
        channel: "email",
        address: "Stop@Example.ORG",
        now: NOW,
      });
      return repo.optedOutChannels(SHOP, { email: "stop@example.org" });
    });
    expect(channels).toEqual(["email"]);
  });

  it("applies a GLOBAL opt-out to every tenant", async () => {
    // Someone who unsubscribed app-wide must stay unsubscribed on a record
    // created later, under a different shop.
    const channels = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: GLOBAL_SCOPE,
        channel: "email",
        address: "gone@example.org",
        now: NOW,
      });
      return repo.optedOutChannels("any.myshopify.com", {
        email: "gone@example.org",
      });
    });
    expect(channels).toEqual(["email"]);
  });

  it("does not silence a different address", async () => {
    const channels = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: SHOP,
        channel: "email",
        address: "stop@example.org",
        now: NOW,
      });
      return repo.optedOutChannels(SHOP, { email: "keep@example.org" });
    });
    expect(channels).toEqual([]);
  });

  it("is idempotent — a second STOP is not an error", async () => {
    const channels = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      for (let i = 0; i < 3; i += 1) {
        await repo.optOut({
          scope: SHOP,
          channel: "email",
          address: "stop@example.org",
          now: NOW + i,
        });
      }
      return repo.optedOutChannels(SHOP, { email: "stop@example.org" });
    });
    expect(channels).toEqual(["email"]);
  });

  it("can be undone by the recipient", async () => {
    const channels = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: SHOP,
        channel: "email",
        address: "back@example.org",
        now: NOW,
      });
      await repo.optIn(SHOP, "email", "back@example.org");
      return repo.optedOutChannels(SHOP, { email: "back@example.org" });
    });
    expect(channels).toEqual([]);
  });

  it("returns nothing when there are no addresses to check", async () => {
    const channels = await inRequest(() =>
      new NotificationSettingsRepo().optedOutChannels(SHOP, {}),
    );
    expect(channels).toEqual([]);
  });
});

describe("normalizeAddress", () => {
  it("lower-cases and trims an email", () => {
    expect(normalizeAddress("email", "  Mixed@Case.COM ")).toBe("mixed@case.com");
  });
});

describe("optedOutAddresses: which of these people have unsubscribed", () => {
  it("returns nothing when none of them has", async () => {
    const out = await inRequest(() =>
      new NotificationSettingsRepo().optedOutAddresses(SHOP, "email", [
        "dev@example.org",
        "ops@example.org",
      ]),
    );
    expect([...out]).toEqual([]);
  });

  it("returns the address that opted out at the tenant's scope", async () => {
    const out = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({ scope: SHOP, channel: "email", address: "gone@example.org", now: NOW });
      return repo.optedOutAddresses(SHOP, "email", ["dev@example.org", "gone@example.org"]);
    });
    expect([...out]).toEqual(["gone@example.org"]);
  });

  it("honours a GLOBAL opt-out too, not just the tenant's", async () => {
    // Someone who unsubscribed app-wide must not be reachable through one shop.
    const out = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: GLOBAL_SCOPE,
        channel: "email",
        address: "gone@example.org",
        now: NOW,
      });
      return repo.optedOutAddresses(SHOP, "email", ["gone@example.org"]);
    });
    expect([...out]).toEqual(["gone@example.org"]);
  });

  it("does NOT leak another tenant's opt-out", async () => {
    const out = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({
        scope: "other.myshopify.com",
        channel: "email",
        address: "gone@example.org",
        now: NOW,
      });
      return repo.optedOutAddresses(SHOP, "email", ["gone@example.org"]);
    });
    expect([...out]).toEqual([]);
  });

  it("matches however the address was capitalised on the way in", async () => {
    const out = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({ scope: SHOP, channel: "email", address: "Gone@Example.ORG", now: NOW });
      return repo.optedOutAddresses(SHOP, "email", ["gone@example.org"]);
    });
    expect([...out]).toEqual(["gone@example.org"]);
  });

  it("does not query at all for an empty list", async () => {
    const out = await inRequest(() =>
      new NotificationSettingsRepo().optedOutAddresses(SHOP, "email", []),
    );
    expect([...out]).toEqual([]);
  });

  it("ignores an opt-out recorded on a different channel", async () => {
    const out = await inRequest(async () => {
      const repo = new NotificationSettingsRepo();
      await repo.optOut({ scope: SHOP, channel: "email", address: "gone@example.org", now: NOW });
      // Same address, asked about as if another channel existed.
      return repo.optedOutAddresses(SHOP, "email", ["other@example.org"]);
    });
    expect([...out]).toEqual([]);
  });
});
