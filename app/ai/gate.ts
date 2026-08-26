import type { AiFailureReason } from "~/ports/ai";
import type { ModelRole } from "./roles";

/**
 * WHO MAY USE AI — the extension point, with no policy in it.
 *
 * This file deliberately contains no notion of a plan, a quota or an
 * entitlement. Those are product decisions that differ per app, and a base that
 * guesses at one makes every app that disagrees delete code before it can start.
 * What the base owns is the SHAPE: a surface, a refusal reason, and a way to
 * compose policies.
 *
 * The default is `allowAll`. An app adds a policy by writing one function and
 * naming it in its own composition root — nothing in `~/services/ai.server` or
 * any AI feature changes.
 *
 * Chain of responsibility, because gating is rarely one rule. Real policies
 * arrive as a list — "AI is on for this plan", "this shop is over its monthly
 * tokens", "AI is off entirely while we investigate" — and each is independently
 * true or false. `composeGates` runs them in order and the FIRST refusal wins,
 * so adding the second rule never means editing the first.
 *
 * @example An app that gates on plan
 * ```ts
 * const planGate: AiGate = {
 *   async refuse({ caller }) {
 *     if (caller.surface !== "merchant") return null;      // our own tooling
 *     const plan = await planFor(caller.shop);
 *     return plan === "max" ? null : "forbidden";
 *   },
 * };
 *
 * // wiring.server.ts — the only file that knows the policy exists
 * export const aiGate = composeGates(killSwitchGate, planGate, quotaGate);
 * ```
 */

/**
 * Which surface is asking. NOT the same question as which shop pays — the ledger
 * records staff work with a null shop because it is our own spend.
 *
 * A closed union, so a policy that forgets a surface fails the build rather than
 * quietly allowing it.
 */
export type AiSurface =
  /** The embedded admin, acting for a merchant. */
  | "merchant"
  /** Our own internal console. Our tooling, our bill. */
  | "staff"
  /** Cron, queues, webhooks — nobody is waiting and nobody is charged. */
  | "system";

/** Who is asking, and on whose behalf. */
export interface AiCaller {
  readonly surface: AiSurface;
  /** The shop the work is for. Null for our own staff or system work. */
  readonly shop: string | null;
}

/**
 * Decides whether one call may proceed.
 *
 * `null` to allow. A reason to refuse — `forbidden` for "you may not", or any
 * other `AiFailureReason` a policy finds more honest.
 */
export interface AiGate {
  refuse(input: { caller: AiCaller; role: ModelRole }): Promise<AiFailureReason | null>;
}

/**
 * The base default: no policy at all.
 *
 * Permissive on purpose. A base that refuses by default would have every app
 * disable a gate they never asked for before their first call works, and a
 * silent refusal is the hardest kind of nothing to debug.
 */
export const allowAll: AiGate = {
  async refuse() {
    return null;
  },
};

/**
 * Run policies in order; the first refusal wins.
 *
 * Short-circuits, so an expensive check (a database read, a quota sum) is only
 * reached when the cheap ones have already passed — put the cheap rule first.
 */
export function composeGates(...gates: readonly AiGate[]): AiGate {
  return {
    async refuse(input) {
      for (const gate of gates) {
        const reason = await gate.refuse(input);
        if (reason) return reason;
      }
      return null;
    },
  };
}

/**
 * A gate that only ever applies to merchant traffic.
 *
 * A wrapper rather than something every policy re-implements: "our own console
 * is not gated by a merchant's plan" is true of almost every rule an app will
 * write, and forgetting it is how a merchant's downgrade breaks the support desk.
 */
export function merchantsOnly(gate: AiGate): AiGate {
  return {
    async refuse(input) {
      if (input.caller.surface !== "merchant") return null;
      return gate.refuse(input);
    },
  };
}
