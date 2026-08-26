import type { PlanKey } from "~/billing/plans";
import type { ModelRole } from "./roles";

/**
 * Who may use AI — the POLICY, as one pure function over one table.
 *
 * Deliberately the smallest possible surface, because this is the part most
 * likely to change: "Max can use AI, Pro cannot" today, per-purpose limits
 * tomorrow, a token quota after that. Everything that could change lives here;
 * the callers name a SURFACE and a ROLE and never ask about plans at all.
 *
 * What that buys, concretely:
 *   - Changing which plans include AI is an edit to `AI_PLAN_ACCESS`.
 *   - Gating one purpose but not another is an edit to `aiRefusal`.
 *   - Turning gating off entirely is one adapter in the composition root.
 *   - Adding a usage quota is a second refusal reason, not a new call site.
 *
 * Nothing above this file knows what a plan is.
 */

/**
 * Which surface is asking. NOT the same question as which shop pays — see the
 * ledger, where staff work is recorded with a null shop because it is our own
 * spend.
 */
export type AiSurface =
  /** The embedded admin, acting for a merchant on their plan. */
  | "merchant"
  /** Our own internal console. Our tooling, our bill. */
  | "staff"
  /** Cron, queues, webhooks — nobody is waiting and nobody is charged. */
  | "system";

/**
 * Whether a plan includes AI at all.
 *
 * `Record<PlanKey, boolean>`, so adding a plan to the catalogue stops this
 * compiling until someone decides whether it gets AI. A plan silently
 * defaulting either way is how a paid feature leaks or a paying merchant is
 * refused.
 */
export const AI_PLAN_ACCESS: Record<PlanKey, boolean> = {
  free: false,
  pro: true,
};

/** Why AI was refused. A subset of `AiFailureReason`, kept in step by the port. */
export type AiRefusal = "forbidden";

/**
 * `null` to proceed, or the reason to refuse.
 *
 * PURE — the caller resolves the plan and hands it in, so the whole policy is
 * provable without a database. An unknown plan FAILS CLOSED: it is not a licence
 * to spend our tokens.
 */
export function aiRefusal(input: {
  surface: AiSurface;
  /** The shop's plan, or null when there is no shop or it could not be read. */
  plan: PlanKey | null;
  /**
   * Carried so per-purpose gating is a change to this function and nothing
   * else, even though no such policy exists today.
   */
  role: ModelRole;
}): AiRefusal | null {
  // Our own surfaces are never gated by a merchant's plan.
  if (input.surface === "staff" || input.surface === "system") return null;

  if (input.plan === null) return "forbidden";
  return AI_PLAN_ACCESS[input.plan] ? null : "forbidden";
}
