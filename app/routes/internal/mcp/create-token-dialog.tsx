import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
} from "ngk-dashboard";
import { Form } from "react-router";
import { Key } from "lucide-react";
import { MCP_SCOPES, SCOPE_DESCRIPTIONS } from "~/domain/mcp/scopes";

function ScopeCheckboxes() {
  return (
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
  );
}

function CreateTokenForm({ setDialogOpen }: { setDialogOpen: (o: boolean) => void }) {
  return (
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
      <ScopeCheckboxes />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
          Cancel
        </Button>
        <Button type="submit">Create Token</Button>
      </DialogFooter>
    </Form>
  );
}

export function CreateTokenDialog({
  dialogOpen,
  setDialogOpen,
}: {
  dialogOpen: boolean;
  setDialogOpen: (o: boolean) => void;
}) {
  return (
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
        <CreateTokenForm setDialogOpen={setDialogOpen} />
      </DialogContent>
    </Dialog>
  );
}
