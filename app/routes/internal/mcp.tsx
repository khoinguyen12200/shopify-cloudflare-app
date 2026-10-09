import { useState } from "react";
import { data, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "MCP & API · Staff Console" },
];
import { Page } from "ngk-dashboard";
import { requireAdminUser } from "~/services/admin-auth.server";
import { adminUsers, adminSessionUsers } from "~/wiring.server";
import { getEnv } from "~/request-context.server";
import {
  createPersonalAccessToken,
  listPersonalAccessTokens,
  revokeTokenById,
} from "~/services/mcp/tokens.server";
import {
  listOAuthClients,
  revokeOAuthClientById,
} from "~/services/mcp/oauth.server";
import { listRecentAuditLogs } from "~/services/mcp/audit.server";
import { TOOL_CATALOG } from "~/mcp/catalog";
import { streamRegion } from "~/internal/stream-region.server";
import { CreatedTokenAlert } from "./mcp/created-token-alert";
import { McpTabs } from "./mcp/mcp-tabs";

export type ActionData =
  | { ok: false; error: string }
  | { ok: true; createdToken: string; tokenLabel: string; tokenId: string }
  | { ok: true; revokedTokenId: string }
  | { ok: true; revokedClientId: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminSessionUsers() });

  const env = getEnv();
  const url = new URL(request.url);
  const appUrl = (env.SHOPIFY_APP_URL || url.origin).replace(/\/$/, "");

  return {
    user: { id: user.id, email: user.email, name: user.name },
    toolCatalog: TOOL_CATALOG,
    appUrl,
    now: Date.now(),
    // Two independent regions, so a slow audit log never holds up the tokens.
    // The default tab (Quick Connect) needs neither and paints at once.
    access: streamRegion(
      "mcp",
      "access",
      Promise.all([listPersonalAccessTokens(), listOAuthClients()]).then(([tokens, clients]) => ({ tokens, clients })),
    ),
    auditLogs: streamRegion("mcp", "audit_logs", listRecentAuditLogs(50)),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminUsers() });
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "create_pat") {
    const label = String(form.get("label") ?? "").trim();
    if (!label) {
      return data<ActionData>({ ok: false, error: "Token label is required" }, { status: 400 });
    }
    const scopesRaw = form.getAll("scopes").map(String);
    const validScopes = scopesRaw.length > 0 ? scopesRaw : ["mcp:read"];
    const expiryParam = form.get("expires_in_days");
    const expiryDays = expiryParam && expiryParam !== "never" ? Number(expiryParam) : null;

    const { rawToken, token } = await createPersonalAccessToken({
      label,
      adminUserId: user.id,
      adminEmail: user.email,
      scopes: validScopes,
      expiresInDays: expiryDays,
    });

    return data<ActionData>({
      ok: true,
      createdToken: rawToken,
      tokenLabel: label,
      tokenId: token.id,
    });
  }

  if (intent === "revoke_token") {
    const tokenId = String(form.get("token_id") ?? "");
    if (tokenId) {
      await revokeTokenById(tokenId);
      return data<ActionData>({ ok: true, revokedTokenId: tokenId });
    }
  }

  if (intent === "revoke_client") {
    const clientId = String(form.get("client_id") ?? "");
    if (clientId) {
      await revokeOAuthClientById(clientId);
      return data<ActionData>({ ok: true, revokedClientId: clientId });
    }
  }

  return data<ActionData>({ ok: false, error: "Invalid intent" }, { status: 400 });
};

function useClipboardCopy() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2500);
  }

  return { copiedText, copy };
}

export default function McpAdmin() {
  const { access, auditLogs, toolCatalog, appUrl, now } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();
  const { copiedText, copy } = useClipboardCopy();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const createdToken =
    actionData && actionData.ok && "createdToken" in actionData
      ? actionData.createdToken
      : null;
  const tokenLabel =
    actionData && actionData.ok && "tokenLabel" in actionData
      ? actionData.tokenLabel
      : null;

  return (
    <Page
      title="MCP & REST API"
      subtitle="Model Context Protocol server and reusable REST APIs for AI agents, monitoring, and automation."
      fullWidth
    >
      <div className="flex flex-col gap-6">
        {createdToken && tokenLabel && (
          <CreatedTokenAlert
            createdToken={createdToken}
            tokenLabel={tokenLabel}
            copiedText={copiedText}
            onCopy={copy}
          />
        )}
        <McpTabs
          access={access}
          auditLogs={auditLogs}
          toolCatalog={toolCatalog}
          appUrl={appUrl}
          now={now}
          onCopy={copy}
          copiedText={copiedText}
          dialogOpen={createDialogOpen}
          setDialogOpen={setCreateDialogOpen}
        />
      </div>
    </Page>
  );
}
