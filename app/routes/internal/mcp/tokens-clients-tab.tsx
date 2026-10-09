import {
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ngk-dashboard";
import { Form } from "react-router";
import type { listPersonalAccessTokens } from "~/services/mcp/tokens.server";
import type { listOAuthClients } from "~/services/mcp/oauth.server";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";
import { CreateTokenDialog } from "./create-token-dialog";

const LOCALE: Locale = "en";

type Token = Awaited<ReturnType<typeof listPersonalAccessTokens>>[number];
type Client = Awaited<ReturnType<typeof listOAuthClients>>[number];

function RevokeForm({
  intent,
  idField,
  id,
  isSubmitting,
}: {
  intent: "revoke_token" | "revoke_client";
  idField: "token_id" | "client_id";
  id: string;
  isSubmitting: boolean;
}) {
  return (
    <Form method="post" className="inline">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name={idField} value={id} />
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-destructive hover:text-destructive"
        disabled={isSubmitting}
      >
        Revoke
      </Button>
    </Form>
  );
}

function ActiveBadge() {
  return (
    <Badge variant="outline" className="text-emerald-600 border-emerald-300">
      Active
    </Badge>
  );
}

function TokenStatusBadge({ isRevoked, isExpired }: { isRevoked: boolean; isExpired: boolean }) {
  if (isRevoked) return <Badge variant="destructive">Revoked</Badge>;
  if (isExpired) return <Badge variant="outline">Expired</Badge>;
  return <ActiveBadge />;
}

function TokenRowView({
  tok,
  now,
  isSubmitting,
}: {
  tok: Token;
  now: number;
  isSubmitting: boolean;
}) {
  const isRevoked = tok.revokedAt !== null;
  const isExpired = tok.expiresAt !== null && now > tok.expiresAt;
  return (
    <TableRow>
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
        <TokenStatusBadge isRevoked={isRevoked} isExpired={isExpired} />
      </TableCell>
      <TableCell className="text-right">
        {!isRevoked && (
          <RevokeForm intent="revoke_token" idField="token_id" id={tok.id} isSubmitting={isSubmitting} />
        )}
      </TableCell>
    </TableRow>
  );
}

function TokensSection({
  tokens,
  isSubmitting,
  dialogOpen,
  setDialogOpen,
  now,
}: {
  tokens: Token[];
  isSubmitting: boolean;
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
  now: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">Personal Access Tokens</h3>
          <p className="text-xs text-muted-foreground">
            Static bearer tokens with customizable scopes for scripts and AI agents.
          </p>
        </div>
        <CreateTokenDialog dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} />
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
                tokens.map((tok) => (
                  <TokenRowView key={tok.id} tok={tok} now={now} isSubmitting={isSubmitting} />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ClientRowView({ cli, isSubmitting }: { cli: Client; isSubmitting: boolean }) {
  const isRevoked = cli.revokedAt !== null;
  return (
    <TableRow>
      <TableCell className="font-medium">{cli.clientName}</TableCell>
      <TableCell className="font-mono text-xs">{cli.clientId}</TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
        {cli.redirectUris.join(", ")}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDateTime(LOCALE, cli.createdAt, UTC)}
      </TableCell>
      <TableCell>
        {isRevoked ? <Badge variant="destructive">Revoked</Badge> : <ActiveBadge />}
      </TableCell>
      <TableCell className="text-right">
        {!isRevoked && (
          <RevokeForm intent="revoke_client" idField="client_id" id={cli.id} isSubmitting={isSubmitting} />
        )}
      </TableCell>
    </TableRow>
  );
}

function ClientsSection({
  clients,
  isSubmitting,
}: {
  clients: Client[];
  isSubmitting: boolean;
}) {
  return (
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
                clients.map((cli) => (
                  <ClientRowView key={cli.id} cli={cli} isSubmitting={isSubmitting} />
                ))
              )}
            </TableBody>
          </Table>
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
  tokens: Token[];
  clients: Client[];
  isSubmitting: boolean;
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
  now: number;
}) {
  return (
    <div className="space-y-8">
      <TokensSection
        tokens={tokens}
        isSubmitting={isSubmitting}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        now={now}
      />
      <ClientsSection clients={clients} isSubmitting={isSubmitting} />
    </div>
  );
}
