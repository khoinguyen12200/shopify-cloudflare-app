import { useState } from "react";
import { data, useActionData, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

export const meta: MetaFunction = () => [
  { title: "MCP & API · Staff Console" },
];
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Page,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "ngk-dashboard";
import { Check, Copy, Key } from "lucide-react";
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
import {
  AuditLogsTab,
  CatalogTab,
  QuickConnectTab,
  TokensClientsTab,
} from "./mcp/components";

export type ActionData =
  | { ok: false; error: string }
  | { ok: true; createdToken: string; tokenLabel: string; tokenId: string }
  | { ok: true; revokedTokenId: string }
  | { ok: true; revokedClientId: string };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await requireAdminUser(request, { users: adminSessionUsers() });
  const [tokens, clients, auditLogs] = await Promise.all([
    listPersonalAccessTokens(),
    listOAuthClients(),
    listRecentAuditLogs(50),
  ]);

  const env = getEnv();
  const url = new URL(request.url);
  const appUrl = (env.SHOPIFY_APP_URL || url.origin).replace(/\/$/, "");

  return {
    user: { id: user.id, email: user.email, name: user.name },
    tokens,
    clients,
    auditLogs,
    toolCatalog: TOOL_CATALOG,
    appUrl,
    now: Date.now(),
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

export default function McpAdmin() {
  const { tokens, clients, auditLogs, toolCatalog, appUrl, now } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2500);
  }

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
          <Alert className="border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
            <Key className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">
              <AlertTitle className="font-semibold text-emerald-800 dark:text-emerald-200">
                Personal Access Token Created: {tokenLabel}
              </AlertTitle>
              <AlertDescription className="mt-2 space-y-2">
                <p className="text-xs">
                  Copy this token now. For security, it will never be displayed again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 p-2 bg-background border rounded text-xs select-all font-mono">
                    {createdToken}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy(createdToken)}
                  >
                    {copiedText === createdToken ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        <Tabs defaultValue="quick-connect" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="quick-connect">Quick Connect</TabsTrigger>
            <TabsTrigger value="tokens-clients">Access Tokens & Clients</TabsTrigger>
            <TabsTrigger value="audit-logs">Activity & Audit Logs</TabsTrigger>
            <TabsTrigger value="catalog">Tool & API Catalog</TabsTrigger>
          </TabsList>

          <TabsContent value="quick-connect" className="space-y-6">
            <QuickConnectTab appUrl={appUrl} onCopy={copy} copiedText={copiedText} />
          </TabsContent>

          <TabsContent value="tokens-clients" className="space-y-6">
            <TokensClientsTab
              tokens={tokens}
              clients={clients}
              isSubmitting={false}
              dialogOpen={createDialogOpen}
              setDialogOpen={setCreateDialogOpen}
              now={now}
            />
          </TabsContent>

          <TabsContent value="audit-logs" className="space-y-6">
            <AuditLogsTab logs={auditLogs} />
          </TabsContent>

          <TabsContent value="catalog" className="space-y-6">
            <CatalogTab catalog={toolCatalog} appUrl={appUrl} />
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}
