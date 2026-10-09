import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ngk-dashboard";
import type { listRecentAuditLogs } from "~/services/mcp/audit.server";
import { formatDateTime } from "~/i18n/format";
import { UTC } from "~/i18n/time-zone";
import type { Locale } from "~/i18n/config";

const LOCALE: Locale = "en";

type AuditLog = Awaited<ReturnType<typeof listRecentAuditLogs>>[number];

function AuditLogRow({ log }: { log: AuditLog }) {
  return (
    <TableRow>
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
  );
}

export function AuditLogsTab({ logs }: { logs: AuditLog[] }) {
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
              logs.map((log) => <AuditLogRow key={log.id} log={log} />)
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
