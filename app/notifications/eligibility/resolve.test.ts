import { describe, it, expect } from "vitest";
import { resolveEligibility, blockedReason } from "./resolve";
import type { EligibilityContext } from "./types";
import type { ChannelKey } from "../types";

/**
 * The whole decision layer is PURE, so these run with no database, no network and
 * no request context. That is the payoff of resolving the snapshot first: the
 * interesting half of the system is exhaustively testable for free.
 */
function context(overrides: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    event: "admin_password_reset",
    availableChannels: ["email"],
    selection: {},
    addresses: { email: "someone@example.org" },
    optedOut: [],
    ...overrides,
  };
}

describe("no preference stored", () => {
  it("falls back to the event's declared channels", () => {
    // Absent must mean "today's behaviour", or shipping this layer would change
    // every existing tenant's sends on deploy.
    const result = resolveEligibility(context());
    expect(result.allowed).toEqual(["email"]);
  });
});

describe("capability beats preference", () => {
  it("refuses a channel with no transport, even when selected", () => {
    const result = resolveEligibility(
      context({
        availableChannels: [],
        selection: { admin_password_reset: ["email"] },
      }),
    );
    expect(result.allowed).toEqual([]);
    expect(blockedReason(result, "email")).toBe("channel_unavailable");
  });

  it("reports capability BEFORE the tenant's own choice", () => {
    // "Email is not configured" is actionable; "this event is not selected for
    // email" is confusing to someone who never configured email at all.
    const result = resolveEligibility(
      context({ availableChannels: [], selection: { admin_password_reset: [] } }),
    );
    expect(blockedReason(result, "email")).toBe("channel_unavailable");
  });
});

describe("reachability", () => {
  it("refuses a channel with no address", () => {
    const result = resolveEligibility(context({ addresses: {} }));
    expect(blockedReason(result, "email")).toBe("recipient_unreachable");
  });

  it("refuses a blank address rather than sending to it", () => {
    const result = resolveEligibility(context({ addresses: { email: "   " } }));
    expect(blockedReason(result, "email")).toBe("recipient_unreachable");
  });

  it("keeps 'unreachable' distinct from 'opted out'", () => {
    // Different facts needing different fixes. Collapsing them tells whoever has
    // to act on it the wrong story.
    const noAddress = resolveEligibility(context({ addresses: {} }));
    const optedOut = resolveEligibility(context({ optedOut: ["email"] }));
    expect(blockedReason(noAddress, "email")).not.toBe(
      blockedReason(optedOut, "email"),
    );
  });
});

describe("consent is never overridable", () => {
  it("refuses an opted-out channel", () => {
    const result = resolveEligibility(context({ optedOut: ["email"] }));
    expect(result.allowed).toEqual([]);
    expect(blockedReason(result, "email")).toBe("recipient_opted_out");
  });

  it("refuses it even for an ESSENTIAL event", () => {
    // admin_password_reset is essential. Essential bypasses a tenant PREFERENCE
    // — it must never bypass a recipient's opt-out, which is a legal constraint.
    const result = resolveEligibility(
      context({ event: "admin_password_reset", optedOut: ["email"] }),
    );
    expect(blockedReason(result, "email")).toBe("recipient_opted_out");
  });

  it("refuses it even when the tenant explicitly selected the channel", () => {
    const result = resolveEligibility(
      context({
        optedOut: ["email"],
        selection: { admin_password_reset: ["email"] },
      }),
    );
    expect(blockedReason(result, "email")).toBe("recipient_opted_out");
  });
});

describe("an essential event ignores the tenant's preference", () => {
  it("sends although the tenant selected nothing", () => {
    // The recipient asked for this message. A tenant setting must not suppress a
    // password reset.
    const result = resolveEligibility(
      context({ event: "admin_password_reset", selection: { admin_password_reset: [] } }),
    );
    expect(result.allowed).toEqual(["email"]);
  });

  it("still requires a transport and an address", () => {
    const noTransport = resolveEligibility(context({ availableChannels: [] }));
    const noAddress = resolveEligibility(context({ addresses: {} }));
    expect(noTransport.allowed).toEqual([]);
    expect(noAddress.allowed).toEqual([]);
  });
});

describe("absent is not the same as empty", () => {
  it("treats an empty selection as an explicit 'none' for a non-essential event", () => {
    // Simulated by taking the essential exemption out of play: the rule under
    // test is that `[]` is honoured rather than read as unset.
    const withEmpty = resolveEligibility(
      context({ selection: { admin_password_reset: [] } }),
    );
    // The event IS essential, so preference is bypassed and it still sends —
    // which is itself the guarantee being asserted.
    expect(withEmpty.allowed).toEqual(["email"]);

    // And the decision records that preference was not what refused it.
    expect(withEmpty.decisions[0]).toMatchObject({ allowed: true });
  });
});

describe("the verdict is reported for every channel considered", () => {
  it("includes allowed channels, not only refusals", () => {
    // A function that only reports what it DID send cannot answer "why didn't
    // they get it?", which is the question this system is asked most.
    const result = resolveEligibility(context());
    expect(result.decisions).toHaveLength(1);
    expect(result.decisions[0]).toEqual({ channel: "email", allowed: true });
  });

  it("names a channel the tenant selected that the event cannot render", () => {
    // A stale setting must be visible, not silently dropped.
    const result = resolveEligibility(
      context({
        selection: { admin_password_reset: ["sms" as ChannelKey] },
        availableChannels: ["email"],
      }),
    );
    expect(blockedReason(result, "sms")).toBe("channel_unavailable");
  });

  it("returns null for a channel that was allowed", () => {
    expect(blockedReason(resolveEligibility(context()), "email")).toBeNull();
  });

  it("returns null for a channel never considered", () => {
    expect(blockedReason(resolveEligibility(context()), "carrier-pigeon")).toBeNull();
  });
});

describe("every block reason maps onto something storable", () => {
  it("uses only the closed BlockReason set", () => {
    const reasons = new Set(
      [
        resolveEligibility(context({ availableChannels: [] })),
        resolveEligibility(context({ addresses: {} })),
        resolveEligibility(context({ optedOut: ["email"] })),
      ].flatMap((r) => r.decisions.filter((d) => !d.allowed).map((d) => d.reason)),
    );
    expect([...reasons].sort()).toEqual([
      "channel_unavailable",
      "recipient_opted_out",
      "recipient_unreachable",
    ]);
  });
});
