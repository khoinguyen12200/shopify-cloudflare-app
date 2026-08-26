import { WorkersAiGenerator, workersAiModelFactory } from "~/adapters/workers-ai.server";
import { allowAll, type AiGate } from "~/ai/gate";
import type { TextGenerator } from "~/ports/ai";

/**
 * THE COMPOSITION ROOT — the one place a port is bound to an adapter.
 *
 * It exists because @rules/architecture.md forbids ring 3 importing ring 4: a
 * use case declares a port and RECEIVES an implementation, it never names one.
 * `AiService` used to import the Workers AI adapter directly, which quietly made
 * the service impossible to run against anything else and dragged the provider
 * into every test that touched it.
 *
 * Everything an app is likely to change about AI is a line in this file:
 *
 *   - a different provider            → swap `aiGenerator`
 *   - a gating policy                 → `composeGates(...)` into `aiGate`
 *   - AI switched off entirely        → a generator that always refuses
 *
 * Built per REQUEST, not at module load: bindings arrive on the request `env`,
 * and a module-level instance would be shared across shops in a reused isolate
 * (@rules/architecture.md — no mutable module state).
 */

/** The text generator every AI use case runs on. */
export function aiGenerator(): TextGenerator {
  return new WorkersAiGenerator({ languageModel: workersAiModelFactory() });
}

/**
 * Who may use AI.
 *
 * `allowAll` in the base: a policy is the app's decision, not the base's. An
 * app returns `composeGates(...)` here — see `~/ai/gate` for the shape and a
 * worked plan-gating example. This is the ONLY file that has to change.
 */
export function aiGate(): AiGate {
  return allowAll;
}
