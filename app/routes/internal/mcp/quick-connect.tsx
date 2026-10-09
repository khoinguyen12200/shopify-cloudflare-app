import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ngk-dashboard";
import { Bot, Shield, Terminal } from "lucide-react";
import { EndpointRow } from "./endpoint-row";

type CopyProps = {
  appUrl: string;
  onCopy: (t: string) => void;
  copiedText: string | null;
};

function agentConfig(serverName: string, appUrl: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
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
}

function EndpointField({
  label,
  text,
  onCopy,
  copiedText,
}: {
  label: string;
  text: string;
  onCopy: (t: string) => void;
  copiedText: string | null;
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
      <EndpointRow text={text} onCopy={onCopy} copied={copiedText === text} />
    </div>
  );
}

function OAuthCard({ appUrl, onCopy, copiedText }: CopyProps) {
  return (
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
          <EndpointField
            label="MCP RPC Endpoint"
            text={`${appUrl}/api/mcp`}
            onCopy={onCopy}
            copiedText={copiedText}
          />
          <EndpointField
            label="OAuth Resource Discovery (RFC 9728)"
            text={`${appUrl}/.well-known/oauth-protected-resource`}
            onCopy={onCopy}
            copiedText={copiedText}
          />
          <EndpointField
            label="Authorization Server Metadata (RFC 8414)"
            text={`${appUrl}/.well-known/oauth-authorization-server`}
            onCopy={onCopy}
            copiedText={copiedText}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function RestApiCard({ appUrl, onCopy, copiedText }: CopyProps) {
  return (
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
          <EndpointField
            label="REST API Root"
            text={`${appUrl}/api/v1/health`}
            onCopy={onCopy}
            copiedText={copiedText}
          />
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
  );
}

function ConfigSnippet({
  label,
  config,
  onCopy,
  copiedText,
}: {
  label: string;
  config: string;
  onCopy: (t: string) => void;
  copiedText: string | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-xs">{label}</span>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onCopy(config)}>
          {copiedText === config ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="p-3 bg-muted rounded text-xs overflow-x-auto font-mono">{config}</pre>
    </div>
  );
}

function AgentSnippetsCard({ appUrl, onCopy, copiedText }: CopyProps) {
  const claudeConfig = agentConfig("shopify-app-ops", appUrl);
  const cursorConfig = agentConfig("shopify-ops", appUrl);

  return (
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
        <ConfigSnippet
          label="Claude Desktop (`claude_desktop_config.json`)"
          config={claudeConfig}
          onCopy={onCopy}
          copiedText={copiedText}
        />
        <ConfigSnippet
          label="Cursor (`.cursor/mcp.json`)"
          config={cursorConfig}
          onCopy={onCopy}
          copiedText={copiedText}
        />
      </CardContent>
    </Card>
  );
}

export function QuickConnectTab(props: CopyProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <OAuthCard {...props} />
      <RestApiCard {...props} />
      <AgentSnippetsCard {...props} />
    </div>
  );
}
