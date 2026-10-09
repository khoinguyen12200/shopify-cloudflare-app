import { ShopifyEventRepo } from "~/models/shopify-events.server";
import { ShopSubscriptionRepo } from "~/models/shop-subscriptions.server";
import { ShopRepo } from "~/models/shops.server";
import { ShopMetricsRepo } from "~/models/shop-metrics.server";
import { AiRepo } from "~/models/ai.server";
import { OperationalHealthRepo } from "~/models/operational-health.server";
import { SupportRepo } from "~/models/support.server";
import { WebhookDeliveryRepo } from "~/models/webhook-deliveries.server";
import { WebhookScopeObservationRepo } from "~/models/webhook-scope-observations.server";
import { ShopSyncCheckpointRepo } from "~/models/shop-sync-checkpoints.server";
import { McpAuditLogRepo, McpOAuthRepo, McpTokenRepo } from "~/models/mcp.server";
import type { McpAuditLogPort, McpOAuthPort, McpTokenPort } from "~/ports/mcp";
import { PlanGrantsRepo } from "~/models/plan-grants.server";
import type { PlanGrantsPort } from "~/ports/plan-grants";
import { invalidateEntitlements } from "~/wiring/entitlement-cache.server";
import { appRuntime } from "~/wiring/runtime.server";

/** Adapter factories are the only production boundary to repository classes. */
export type ShopsPort = Pick<ShopRepo, "get" | "recordAuthenticatedIdentity" | "recordInstall" | "updateShopIdentity" | "applyUninstall" | "markReconciled" | "listAll" | "setDevStatus">;
export type SupportPort = Pick<SupportRepo, "find" | "findForStaff" | "stageUpload" | "adoptPendingUploads" | "findAttachment" | "listForShop" | "listOpenForStaff" | "listKnownContacts" | "replyAsStaff" | "closeAsStaff" | "markReadAsStaff" | "setCcEmails" | "attachMany" | "open" | "openAsStaff" | "reply" | "markRead" | "listExpiredUploads" | "deleteExpiredUploads">;
export type ShopSubscriptionsPort = Pick<ShopSubscriptionRepo, "currentForShop" | "listCurrentForShops" | "upsertObservation">;
export type ShopifyEventsPort = Pick<ShopifyEventRepo, "listSubscriptionEvents" | "listRelationshipEvents" | "listRecentSubscriptionEvents" | "recordPartnerRelationship" | "recordPartnerSubscription" | "listAllUninstallFeedback">;
export type ShopSyncCheckpointsPort = Pick<ShopSyncCheckpointRepo, "read" | "markSucceeded" | "markFailed" | "readCheckpoint" | "markCheckpointSucceeded" | "markCheckpointFailed">;
export type WebhookScopeObservationsPort = Pick<WebhookScopeObservationRepo, "record" | "list" | "applyScopes" | "listGrantedForShop" | "latestChangeAt">;
export type WebhookDeliveryRepositoryPort = Pick<WebhookDeliveryRepo, "listForShop" | "claim" | "get" | "markQueued" | "markProcessing" | "markProcessed" | "markFailed" | "markDeadLetter" | "listFailures" | "deleteDelivery">;
export type OperationalHealthPort = Pick<OperationalHealthRepo, "read">;
export type AiRepositoryPort = Pick<AiRepo, "chainFor" | "markHealth" | "recordRun" | "allModels" | "tokensSince" | "recentRuns" | "addToChain" | "removeFromChain" | "reorder" | "setEnabled">;

export function shops(): ShopsPort { return new ShopRepo(); }
export function shopMetrics(): ShopMetricsRepo { return new ShopMetricsRepo(); }
export function support(): SupportPort { return new SupportRepo(appRuntime().ids); }
export function shopSubscriptions(): ShopSubscriptionsPort { return new ShopSubscriptionRepo({ invalidate: invalidateEntitlements }); }
export function shopifyEvents(): ShopifyEventsPort { return new ShopifyEventRepo(); }
export function shopSyncCheckpoints(): ShopSyncCheckpointsPort { return new ShopSyncCheckpointRepo(); }
export function webhookScopeObservations(): WebhookScopeObservationsPort { return new WebhookScopeObservationRepo(); }
export function webhookDeliveryRepository(): WebhookDeliveryRepositoryPort { return new WebhookDeliveryRepo(); }
export function operationalHealth(): OperationalHealthPort { return new OperationalHealthRepo(); }
export function aiRepository(): AiRepositoryPort { return new AiRepo(); }
export function mcpTokens(): McpTokenPort { return new McpTokenRepo(); }
export function mcpOAuth(): McpOAuthPort { return new McpOAuthRepo(); }
export function mcpAuditLogs(): McpAuditLogPort { return new McpAuditLogRepo(); }
export function planGrants(): PlanGrantsPort { return new PlanGrantsRepo(); }

export function webhookDeliveries() {
  return webhookDeliveryRepository();
}
