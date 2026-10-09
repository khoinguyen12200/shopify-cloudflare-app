import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ngk-dashboard";
import type { TOOL_CATALOG } from "~/mcp/catalog";

type CatalogTool = (typeof TOOL_CATALOG)[number]["tools"][number];

function ToolCard({ tool }: { tool: CatalogTool }) {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-mono text-sm">{tool.name}</CardTitle>
          <Badge variant={tool.isMutation ? "secondary" : "outline"} className="text-[10px]">
            {tool.isMutation ? "Mutation" : "Read-Only"}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-1">{tool.summary}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>Scope: <code className="bg-muted px-1 py-0.5 rounded">{tool.scope}</code></span>
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
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
