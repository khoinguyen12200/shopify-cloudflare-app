import type { AiModel, AiRun } from "~/db/schema";
import {
  ROLES_IN_USE,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  type ModelRole,
} from "~/ai/roles";
import { findCatalogueModel } from "~/ai/catalogue";
import { rankModelsForRole } from "~/ai/ranking";
import { isDemoted } from "~/ai/chain";
import { modelNote } from "./model-note";

function chainEntry(row: AiModel, now: number) {
  return {
    modelId: row.modelId,
    label: findCatalogueModel(row.modelId)?.label ?? row.modelId,
    enabled: row.enabled,
    // Demoted by the RUNTIME after a failure — not something an admin set.
    demoted: isDemoted(
      {
        modelId: row.modelId,
        priority: row.priority,
        enabled: row.enabled,
        healthy: row.healthy,
        lastFailedAt: row.lastFailedAt,
      },
      now,
    ),
    // A model chosen before Cloudflare retired it still WORKS; say so
    // rather than showing it as an ordinary choice.
    retired: findCatalogueModel(row.modelId) === undefined,
  };
}

export function buildPurpose(role: ModelRole, rows: readonly AiModel[], now: number) {
  const chain = rows.filter((row) => row.role === role);
  const chosen = new Set(chain.map((row) => row.modelId));

  return {
    role,
    label: ROLE_LABEL[role],
    description: ROLE_DESCRIPTION[role],
    usedBy: ROLES_IN_USE[role],
    chain: chain.map((row) => chainEntry(row, now)),
    // Ranked FOR THIS PURPOSE, best first, minus what is already in the
    // chain — so the top of the list is always the right next pick.
    available: rankModelsForRole(role)
      .filter((model) => !chosen.has(model.id))
      .map((model) => ({
        id: model.id,
        label: model.label,
        note: modelNote(model),
      })),
  };
}

export function summarizeRun(run: AiRun) {
  return {
    id: run.id,
    role: run.role,
    feature: run.feature,
    modelId: run.modelId,
    status: run.status,
    reasonCode: run.reasonCode,
    tokens: (run.inputTokens ?? 0) + (run.outputTokens ?? 0),
    latencyMs: run.latencyMs,
  };
}

export type Purpose = ReturnType<typeof buildPurpose>;
export type RecentRun = ReturnType<typeof summarizeRun>;
