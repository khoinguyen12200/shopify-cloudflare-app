import { Button } from "ngk-dashboard";
import { Check, Copy } from "lucide-react";

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
