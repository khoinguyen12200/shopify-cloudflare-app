import type { ModelRole } from "~/ai/roles";
import type { AiFailureReason, AiUsage } from "~/ports/ai";

export interface AiRepository {
  chainFor(role: ModelRole, now: number): Promise<string[]>;
  markHealth(input: { role: ModelRole; modelId: string; healthy: boolean; at: number }): Promise<void>;
  recordRun(input: {
    role: ModelRole;
    modelId: string;
    feature: string;
    shop: string | null;
    status: "ok" | "error";
    reasonCode: AiFailureReason | null;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    createdAt: number;
  }): Promise<void>;
}

export type { AiUsage };
