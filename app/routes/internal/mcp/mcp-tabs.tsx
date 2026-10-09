import type { ComponentProps } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ngk-dashboard";
import { Deferred, TableSkeleton } from "~/internal/components";
import { AuditLogsTab } from "./audit-logs-tab";
import { CatalogTab } from "./catalog-tab";
import { QuickConnectTab } from "./quick-connect";
import { TokensClientsTab } from "./tokens-clients-tab";

export function McpTabs({
  access,
  auditLogs,
  toolCatalog,
  appUrl,
  now,
  onCopy,
  copiedText,
  dialogOpen,
  setDialogOpen,
}: {
  access: Promise<{
    tokens: ComponentProps<typeof TokensClientsTab>["tokens"];
    clients: ComponentProps<typeof TokensClientsTab>["clients"];
  }>;
  auditLogs: Promise<ComponentProps<typeof AuditLogsTab>["logs"]>;
  toolCatalog: ComponentProps<typeof CatalogTab>["catalog"];
  appUrl: string;
  now: number;
  onCopy: (text: string) => void;
  copiedText: string | null;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}) {
  return (
    <Tabs defaultValue="quick-connect" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="quick-connect">Quick Connect</TabsTrigger>
        <TabsTrigger value="tokens-clients">Access Tokens & Clients</TabsTrigger>
        <TabsTrigger value="audit-logs">Activity & Audit Logs</TabsTrigger>
        <TabsTrigger value="catalog">Tool & API Catalog</TabsTrigger>
      </TabsList>

      <TabsContent value="quick-connect" className="space-y-6">
        <QuickConnectTab appUrl={appUrl} onCopy={onCopy} copiedText={copiedText} />
      </TabsContent>

      <TabsContent value="tokens-clients" className="space-y-6">
        <Deferred resolve={access} fallback={<AccessSkeleton />} errorTitle="Access tokens and clients">
          {({ tokens, clients }) => (
            <TokensClientsTab
              tokens={tokens}
              clients={clients}
              isSubmitting={false}
              dialogOpen={dialogOpen}
              setDialogOpen={setDialogOpen}
              now={now}
            />
          )}
        </Deferred>
      </TabsContent>

      <TabsContent value="audit-logs" className="space-y-6">
        <Deferred resolve={auditLogs} fallback={<TableSkeleton rows={8} columns={5} />} errorTitle="Audit logs">
          {(logs) => <AuditLogsTab logs={logs} />}
        </Deferred>
      </TabsContent>

      <TabsContent value="catalog" className="space-y-6">
        <CatalogTab catalog={toolCatalog} appUrl={appUrl} />
      </TabsContent>
    </Tabs>
  );
}

/** Tokens table, then the OAuth clients table, as the real tab lays them out. */
function AccessSkeleton() {
  return (
    <div aria-hidden className="space-y-6">
      <TableSkeleton rows={3} columns={5} />
      <TableSkeleton rows={3} columns={4} />
    </div>
  );
}
