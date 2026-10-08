import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ngk-dashboard";
import { Form } from "react-router";
import { Check, Copy, Key, Shield, Terminal, Bot } from "lucide-react";
import type { listPersonalAccessTokens } from "~/services/mcp/tokens.server";
import type { listOAuthClients } from "~/services/mcp/oauth.server";
import type { listRecentAuditLogs } from "~/services/mcp/audit.server";
import type { TOOL_CATALOG } from "~/mcp/catalog";
import { MCP_SCOPES, SCOPE_DESCRIPTIONS } from "~/domain/mcp/scopes";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";

const LOCALE: Locale = "en";

export function EndpointRow({
  text,
  onCopy,
  copied,
}: {
  text: string;
  onCopy: (t: string) => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <code className="flex-1 p-1.5 bg-muted rounded text-xs font-mono select-all truncate">
        {text}
      </code>
      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onCopy(text)}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

export function QuickConnectTab({
  appUrl,
  onCopy,
  copiedText,
}: {
  appUrl: string;
  onCopy: (t: string) => void;
  copiedText: string | null;
}) {
  const claudeConfig = JSON.stringify(
    {
      mcpServers: {
        "shopify-app-ops": {
          url: `${appUrl}/api/mcp`,
          headers: {
            Authorization: "Bearer <YOUR_PAT_TOKEN>",
          },
        },
      },
    },
    null,
    2,
  );

  const cursorConfig = JSON.stringify(
    {
      mcpServers: {
        "shopify-ops": {
          url: `${appUrl}/api/mcp`,
          headers: {
            Authorization: "Bearer <YOUR_PAT_TOKEN>",
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Zero-Touch OAuth 2.0</CardTitle>
          </div>
          <CardDescription>
            Seamless agent discovery via RFC 8414 & RFC 9728. Point compatible agents directly to this domain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Agents supporting standard OAuth discovery can automatically register and connect without manual token copy-pasting.
          </p>
          <div className="space-y-2 pt-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                MCP RPC Endpoint
              </span>
              <EndpointRow text={`${appUrl}/api/mcp`} onCopy={onCopy} copied={copiedText === `${appUrl}/api/mcp`} />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                OAuth Resource Discovery (RFC 9728)
              </span>
              <EndpointRow
                text={`${appUrl}/.well-known/oauth-protected-resource`}
                onCopy={onCopy}
                copied={copiedText === `${appUrl}/.well-known/oauth-protected-resource`}
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Authorization Server Metadata (RFC 8414)
              </span>
              <EndpointRow
                text={`${appUrl}/.well-known/oauth-authorization-server`}
                onCopy={onCopy}
                copied={copiedText === `${appUrl}/.well-known/oauth-authorization-server`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            <CardTitle>REST API Base URL</CardTitle>
          </div>
          <CardDescription>
            Reusable HTTP endpoints for external dashboards, CI/CD, and scripts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            All MCP tools are also reachable as standard JSON REST endpoints at <code>/api/v1/*</code> using standard Bearer authentication.
          </p>
          <div className="space-y-2 pt-2">
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                REST API Root
              </span>
              <EndpointRow
                text={`${appUrl}/api/v1/health`}
                onCopy={onCopy}
                copied={copiedText === `${appUrl}/api/v1/health`}
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                cURL Example
              </span>
              <pre className="p-3 bg-muted rounded text-xs overflow-x-auto font-mono">
                {`curl -H "Authorization: Bearer <TOKEN>" \\
  ${appUrl}/api/v1/metrics/revenue`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <CardTitle>AI Agent Configuration Snippets</CardTitle>
          </div>
          <CardDescription>
            Paste into your AI coding tool's configuration to enable store monitoring and support management.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">Claude Desktop (`claude_desktop_config.json`)</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onCopy(claudeConfig)}>
                {copiedText === claudeConfig ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="p-3 bg-muted rounded text-xs overflow-x-auto font-mono">
              {claudeConfig}
            </pre>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">Cursor (`.cursor/mcp.json`)</span>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onCopy(cursorConfig)}>
                {copiedText === cursorConfig ? "Copied" : "Copy"}
              </Button>
            </div>
            <pre className="p-3 bg-muted rounded text-xs overflow-x-auto font-mono">
              {cursorConfig}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function TokensClientsTab({
  tokens,
  clients,
  isSubmitting,
  dialogOpen,
  setDialogOpen,
  now,
}: {
  tokens: Awaited<ReturnType<typeof listPersonalAccessTokens>>;
  clients: Awaited<ReturnType<typeof listOAuthClients>>;
  isSubmitting: boolean;
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
  now: number;
}) {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Personal Access Tokens</h3>
            <p className="text-xs text-muted-foreground">
              Static bearer tokens with customizable scopes for scripts and AI agents.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Key className="h-4 w-4 mr-1.5" />
                Generate New Token
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Personal Access Token</DialogTitle>
                <DialogDescription>
                  Create a scoped bearer token for AI agents or automated scripts.
                </DialogDescription>
              </DialogHeader>
              <Form method="post" className="space-y-4 pt-2" onSubmit={() => setDialogOpen(false)}>
                <input type="hidden" name="intent" value="create_pat" />
                <div className="space-y-1.5">
                  <Label htmlFor="label">Token Label / Purpose</Label>
                  <Input
                    id="label"
                    name="label"
                    placeholder="e.g. Claude Desktop on Mac"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expires_in_days">Expiration</Label>
                  <select
                    id="expires_in_days"
                    name="expires_in_days"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                    <option value="never">Never expires</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Permissions / Scopes</Label>
                  <div className="space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto">
                    {MCP_SCOPES.map((scope) => {
                      const desc = SCOPE_DESCRIPTIONS[scope];
                      return (
                        <label key={scope} className="flex items-start gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            name="scopes"
                            value={scope}
                            defaultChecked={scope === "mcp:read" || scope === "mcp:tickets:write"}
                            className="mt-0.5"
                          />
                          <div>
                            <span className="font-semibold text-foreground">{desc?.label ?? scope}</span>
                            <span className="text-muted-foreground block text-[11px]">{desc?.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Token</Button>
                </DialogFooter>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table className="[&_th]:h-10 [&_th]:px-4 [&_td]:px-4 [&_td]:py-2.5">
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      No personal access tokens generated yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tokens.map((tok) => {
                    const isRevoked = tok.revokedAt !== null;
                    const isExpired = tok.expiresAt !== null && now > tok.expiresAt;
                    return (
                      <TableRow key={tok.id}>
                        <TableCell className="font-medium">{tok.label}</TableCell>
                        <TableCell className="font-mono text-xs">{tok.tokenPrefix}...</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {tok.scopes.map((s) => (
                              <Badge key={s} variant="outline" className="text-[10px]">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {tok.lastUsedAt ? formatDateTime(LOCALE, tok.lastUsedAt, UTC) : "Never"}
                        </TableCell>
                        <TableCell>
                          {isRevoked ? (
                            <Badge variant="destructive">Revoked</Badge>
                          ) : isExpired ? (
                            <Badge variant="outline">Expired</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isRevoked && (
                            <Form method="post" className="inline">
                              <input type="hidden" name="intent" value="revoke_token" />
                              <input type="hidden" name="token_id" value={tok.id} />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                disabled={isSubmitting}
                              >
                                Revoke
                              </Button>
                            </Form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-4">
          <h3 className="text-base font-semibold">Registered OAuth 2.0 Clients</h3>
          <p className="text-xs text-muted-foreground">
            Dynamically registered agents via RFC 7591.
          </p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table className="[&_th]:h-10 [&_th]:px-4 [&_td]:px-4 [&_td]:py-2.5">
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Redirect URIs</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      No OAuth clients registered yet. Connect an agent via Zero-Touch OAuth to see it here.
                    </TableCell>
                  </TableRow>
                ) : (
                  clients.map((cli) => {
                    const isRevoked = cli.revokedAt !== null;
                    return (
                      <TableRow key={cli.id}>
                        <TableCell className="font-medium">{cli.clientName}</TableCell>
                        <TableCell className="font-mono text-xs">{cli.clientId}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {cli.redirectUris.join(", ")}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateTime(LOCALE, cli.createdAt, UTC)}
                        </TableCell>
                        <TableCell>
                          {isRevoked ? (
                            <Badge variant="destructive">Revoked</Badge>
                          ) : (
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                              Active
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isRevoked && (
                            <Form method="post" className="inline">
                              <input type="hidden" name="intent" value="revoke_client" />
                              <input type="hidden" name="client_id" value={cli.id} />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                                disabled={isSubmitting}
                              >
                                Revoke
                              </Button>
                            </Form>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AuditLogsTab({
  logs,
}: {
  logs: Awaited<ReturnType<typeof listRecentAuditLogs>>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit & Activity Stream</CardTitle>
        <CardDescription>
          Real-time log of tool calls, mutations, shop lookups, and replies made through MCP and REST APIs.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table className="[&_th]:h-10 [&_th]:px-4 [&_td]:px-4 [&_td]:py-2.5">
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Tool / Endpoint</TableHead>
              <TableHead>Shop</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Latency</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  No activity logged yet. Call any MCP tool or API endpoint to start tracking.
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDateTime(LOCALE, log.createdAt, UTC)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{log.actorEmail}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {log.actorType === "oauth_agent" ? "OAuth Agent" : "Personal Token"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.toolName}</TableCell>
                  <TableCell className="text-xs">{log.shop ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={log.isMutation ? "secondary" : "outline"} className="text-[10px]">
                      {log.isMutation ? "Mutation" : "Query"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.ok ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                        200 OK
                      </Badge>
                    ) : (
                      <Badge variant="destructive" title={log.errorMessage ?? undefined}>
                        Error
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono text-muted-foreground">
                    {log.latencyMs}ms
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function CatalogTab({
  catalog,
}: {
  catalog: typeof TOOL_CATALOG;
  appUrl: string;
}) {
  return (
    <div className="space-y-6">
      {catalog.map((group) => (
        <div key={group.domain} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {group.domain}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.tools.map((tool) => (
              <Card key={tool.name} className="flex flex-col justify-between">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="font-mono text-sm">{tool.name}</CardTitle>
                    <Badge variant={tool.isMutation ? "secondary" : "outline"} className="text-[10px]">
                      {tool.isMutation ? "Mutation" : "Read-Only"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs mt-1">
                    {tool.summary}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Scope: <code className="bg-muted px-1 py-0.5 rounded">{tool.scope}</code></span>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
