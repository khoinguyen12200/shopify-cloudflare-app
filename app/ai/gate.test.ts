import { describe, it, expect } from "vitest";
import { allowAll, composeGates, merchantsOnly, type AiCaller, type AiGate } from "./gate";
import type { AiFailureReason } from "~/ports/ai";

const MERCHANT: AiCaller = { surface: "merchant", shop: "alpha.myshopify.com" };
const STAFF: AiCaller = { surface: "staff", shop: null };
const SYSTEM: AiCaller = { surface: "system", shop: null };

const ask = (gate: AiGate, caller: AiCaller) =>
  gate.refuse({ caller, role: "writing" });

/** A policy that always refuses, and counts how often it was consulted. */
function refusing(reason: AiFailureReason = "forbidden") {
  let calls = 0;
  const gate: AiGate = {
    async refuse() {
      calls += 1;
      return reason;
    },
  };
  return { gate, calls: () => calls };
}

function allowing() {
  let calls = 0;
  const gate: AiGate = {
    async refuse() {
      calls += 1;
      return null;
    },
  };
  return { gate, calls: () => calls };
}

describe("the base default", () => {
  it("allows everyone, because a policy is the app's decision not the base's", async () => {
    // A base that refused by default would have every app disable a gate they
    // never asked for before their first call worked.
    for (const caller of [MERCHANT, STAFF, SYSTEM]) {
      expect(await ask(allowAll, caller), caller.surface).toBeNull();
    }
  });
});

describe("composing policies", () => {
  it("allows when every policy allows", async () => {
    expect(await ask(composeGates(allowing().gate, allowing().gate), MERCHANT)).toBeNull();
  });

  it("refuses with the FIRST refusal", async () => {
    const first = refusing("forbidden");
    const second = refusing("rate_limited");

    expect(await ask(composeGates(first.gate, second.gate), MERCHANT)).toBe("forbidden");
  });

  it("short-circuits, so an expensive check is not reached once refused", async () => {
    // Put the cheap rule first and the quota query never runs for a shop that
    // is not entitled anyway.
    const cheap = refusing();
    const expensive = allowing();

    await ask(composeGates(cheap.gate, expensive.gate), MERCHANT);

    expect(cheap.calls()).toBe(1);
    expect(expensive.calls()).toBe(0);
  });

  it("allows when composed with nothing at all", async () => {
    expect(await ask(composeGates(), MERCHANT)).toBeNull();
  });

  it("passes the role through, so a policy can gate one purpose", async () => {
    const seen: string[] = [];
    const gate: AiGate = {
      async refuse({ role }) {
        seen.push(role);
        return null;
      },
    };

    await composeGates(gate).refuse({ caller: MERCHANT, role: "summary" });
    expect(seen).toEqual(["summary"]);
  });
});

describe("merchantsOnly", () => {
  it("applies the policy to merchant traffic", async () => {
    expect(await ask(merchantsOnly(refusing().gate), MERCHANT)).toBe("forbidden");
  });

  it("never gates our own console", async () => {
    // A merchant downgrading must not break our support desk.
    expect(await ask(merchantsOnly(refusing().gate), STAFF)).toBeNull();
  });

  it("never gates system work", async () => {
    expect(await ask(merchantsOnly(refusing().gate), SYSTEM)).toBeNull();
  });

  it("does not even consult the policy for a non-merchant", async () => {
    // So a policy is free to assume `caller.shop` is present.
    const inner = refusing();
    await ask(merchantsOnly(inner.gate), STAFF);
    expect(inner.calls()).toBe(0);
  });
});
