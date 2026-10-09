import { Alert, AlertDescription, AlertTitle, Button } from "ngk-dashboard";
import { Check, Copy, Key } from "lucide-react";

export function CreatedTokenAlert({
  createdToken,
  tokenLabel,
  copiedText,
  onCopy,
}: {
  createdToken: string;
  tokenLabel: string;
  copiedText: string | null;
  onCopy: (text: string) => void;
}) {
  return (
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
              onClick={() => onCopy(createdToken)}
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
  );
}
