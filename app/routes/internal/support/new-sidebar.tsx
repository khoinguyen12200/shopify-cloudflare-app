import type { ReactNode } from "react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "ngk-dashboard";
import { Info } from "lucide-react";
import type { ShopContactInfo } from "./new-form-state";

function PreviewRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-2">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function RecipientValue({ email }: { readonly email: string | null }) {
  if (!email) return <span className="text-xs text-amber-600">No email found</span>;
  return (
    <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-[160px]">
      {email}
    </span>
  );
}

interface OutreachPreviewProps {
  readonly effectiveShop: string;
  readonly contact: ShopContactInfo;
  readonly actorName: string;
}

export function OutreachPreview({ effectiveShop, contact, actorName }: OutreachPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Outreach Preview</CardTitle>
        <CardDescription>Summary of how this ticket will be delivered.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3.5 text-sm">
        <PreviewRow label="Destination:">
          <span className="font-mono text-xs truncate max-w-[160px]">{effectiveShop || "—"}</span>
        </PreviewRow>
        <PreviewRow label="Merchant:">
          <span className="font-medium text-xs truncate max-w-[160px]">{contact.shopName}</span>
        </PreviewRow>
        <PreviewRow label="Recipient:">
          <RecipientValue email={contact.merchantEmail} />
        </PreviewRow>
        <PreviewRow label="Author:">
          <span className="text-xs font-medium">{actorName}</span>
        </PreviewRow>
        <PreviewRow label="Initial Status:">
          <Badge variant="secondary" className="text-xs font-normal">Waiting on merchant</Badge>
        </PreviewRow>
      </CardContent>
    </Card>
  );
}

export function OutreachNotes() {
  return (
    <Card className="bg-muted/20 border-dashed">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Info className="size-4 text-primary" />
          <CardTitle className="text-sm">Proactive Outreach</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          • <strong>Email Dispatch:</strong> When created, an email with your message and direct thread link is sent to the merchant.
        </p>
        <p>
          • <strong>Replies:</strong> When the merchant replies by email or in the app, their response reopens the ticket and notifies staff.
        </p>
        <p>
          • <strong>AI Polish:</strong> You can quickly type bullet notes and click &ldquo;Polish &amp; optimize&rdquo; to draft a professional message.
        </p>
      </CardContent>
    </Card>
  );
}
