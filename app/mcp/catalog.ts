export const MCP_SERVER_NAME = "shopify-app-admin";
export const MCP_SERVER_VERSION = "1.0.0";

export interface ToolCatalogEntry {
  readonly name: string;
  readonly domain: string;
  readonly scope: string;
  readonly isMutation: boolean;
  readonly summary: string;
}

export const TOOL_CATALOG: {
  readonly domain: string;
  readonly tools: readonly ToolCatalogEntry[];
}[] = [
  {
    domain: "Revenue & Platform Metrics",
    tools: [
      {
        name: "get_revenue_and_plans",
        domain: "Revenue & Platform Metrics",
        scope: "mcp:read",
        isMutation: false,
        summary: "Real MRR by currency and store count per plan (excluding dev stores).",
      },
      {
        name: "get_churn_and_retention",
        domain: "Revenue & Platform Metrics",
        scope: "mcp:read",
        isMutation: false,
        summary: "Churn rate, uninstalls, net growth, and scheduled cancellations.",
      },
      {
        name: "get_system_health",
        domain: "Revenue & Platform Metrics",
        scope: "mcp:read",
        isMutation: false,
        summary: "Overall system vitals, webhook failures, and open ticket counts.",
      },
      {
        name: "get_ai_spend_and_usage",
        domain: "Revenue & Platform Metrics",
        scope: "mcp:read",
        isMutation: false,
        summary: "Internal Workers AI tokens, drafting calls, latency, and costs.",
      },
    ],
  },
  {
    domain: "Store Onboarding & Operations",
    tools: [
      {
        name: "list_new_stores",
        domain: "Store Onboarding & Operations",
        scope: "mcp:shops:read",
        isMutation: false,
        summary: "Stores newly installed in the last N hours.",
      },
      {
        name: "list_shops",
        domain: "Store Onboarding & Operations",
        scope: "mcp:shops:read",
        isMutation: false,
        summary: "Directory of stores with install status, plan, and dev flag.",
      },
      {
        name: "get_shop_dossier",
        domain: "Store Onboarding & Operations",
        scope: "mcp:shops:read",
        isMutation: false,
        summary: "360-degree merchant dossier: plan, installation, tickets, and quotas.",
      },
      {
        name: "set_shop_dev_status",
        domain: "Store Onboarding & Operations",
        scope: "mcp:shops:write",
        isMutation: true,
        summary: "Tag or untag a store as a development / test store.",
      },
      {
        name: "get_shop_webhook_status",
        domain: "Store Onboarding & Operations",
        scope: "mcp:shops:read",
        isMutation: false,
        summary: "Check a shop's webhook connectivity and granted OAuth scopes.",
      },
      {
        name: "list_webhook_failures",
        domain: "Store Onboarding & Operations",
        scope: "mcp:read",
        isMutation: false,
        summary: "Inspect failed or dead-lettered Shopify webhooks.",
      },
    ],
  },
  {
    domain: "Support Ticket Operations",
    tools: [
      {
        name: "list_tickets",
        domain: "Support Ticket Operations",
        scope: "mcp:read",
        isMutation: false,
        summary: "List support tickets filtered by status, unread, or category.",
      },
      {
        name: "get_ticket_thread",
        domain: "Support Ticket Operations",
        scope: "mcp:read",
        isMutation: false,
        summary: "Fetch full conversation thread with messages and attachments.",
      },
      {
        name: "reply_to_ticket",
        domain: "Support Ticket Operations",
        scope: "mcp:tickets:write",
        isMutation: true,
        summary: "Post staff reply and email the merchant automatically.",
      },
      {
        name: "update_ticket_status",
        domain: "Support Ticket Operations",
        scope: "mcp:tickets:write",
        isMutation: true,
        summary: "Close or reopen a customer support ticket.",
      },
      {
        name: "create_ticket",
        domain: "Support Ticket Operations",
        scope: "mcp:tickets:write",
        isMutation: true,
        summary: "Open a support ticket on behalf of a merchant.",
      },
    ],
  },
  {
    domain: "Security & Audit",
    tools: [
      {
        name: "list_audit_logs",
        domain: "Security & Audit",
        scope: "mcp:admin",
        isMutation: false,
        summary: "Inspect recent MCP tool and API invocations.",
      },
    ],
  },
];
