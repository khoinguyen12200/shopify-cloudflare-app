import { appRuntime, mcpAuditLogs } from "~/wiring.server";
import type { McpAuditLog } from "~/db/schema/mcp";
import type { Runtime } from "~/ports/runtime";

export interface RecordAuditInput {
  tokenId?: string | null;
  clientId?: string | null;
  actorEmail: string;
  actorType: "staff_pat" | "oauth_agent";
  toolName: string;
  shop?: string | null;
  isMutation: boolean;
  ok: boolean;
  latencyMs: number;
  errorMessage?: string | null;
  createdAt?: number;
}

export async function recordAuditLog(input: RecordAuditInput, runtime: Pick<Runtime, "clock" | "ids"> = appRuntime()): Promise<void> {
  const now = input.createdAt ?? runtime.clock.now();
  await mcpAuditLogs().createLog({
    id: `aud_${runtime.ids.uuid()}`,
    tokenId: input.tokenId ?? null,
    clientId: input.clientId ?? null,
    actorEmail: input.actorEmail,
    actorType: input.actorType,
    toolName: input.toolName,
    shop: input.shop ?? null,
    isMutation: input.isMutation,
    ok: input.ok,
    latencyMs: input.latencyMs,
    errorMessage: input.errorMessage ?? null,
    createdAt: now,
  });
}

export async function listRecentAuditLogs(limit = 25): Promise<McpAuditLog[]> {
  return mcpAuditLogs().listRecentLogs(limit);
}
