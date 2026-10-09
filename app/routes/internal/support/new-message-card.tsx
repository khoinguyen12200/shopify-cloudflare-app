import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Textarea,
} from "ngk-dashboard";
import { Sparkles } from "lucide-react";
import { BODY_MAX } from "~/schemas/support";
import { InternalAttachmentPicker } from "~/components/support/InternalAttachmentPicker";
import type { usePendingUploads } from "~/routes/app/support/use-pending-uploads";
import type { useReplyDraft } from "~/internal/use-reply-draft";
import { REPLY_TONES, TONE_LABEL, toReplyTone } from "~/ai/tones";
import type { NewTicketForm } from "./new-form-state";

type ReplyDraft = ReturnType<typeof useReplyDraft>;

interface MessageCardProps {
  readonly form: NewTicketForm;
  readonly draft: ReplyDraft;
  readonly uploads: ReturnType<typeof usePendingUploads>;
  readonly isSubmitting: boolean;
}

function aiActionLabel(form: NewTicketForm): string {
  if (form.instruction.trim() !== "") return "Write message";
  return form.bodyText.trim() !== "" ? "Polish & optimize" : "Draft message";
}

function ToneSelect({ form }: { readonly form: NewTicketForm }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="tone-select" className="text-xs text-muted-foreground">Tone:</Label>
      <Select value={form.tone} onValueChange={(next) => form.setTone(toReplyTone(next))}>
        <SelectTrigger id="tone-select" className="w-32 h-8 text-xs" aria-label="Tone">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {REPLY_TONES.map((option) => (
            <SelectItem key={option} value={option}>
              {TONE_LABEL[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DraftButton({ form, draft, isSubmitting }: Omit<MessageCardProps, "uploads">) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 text-xs border-purple-300 hover:bg-purple-100/60 dark:border-purple-800 dark:hover:bg-purple-950"
      disabled={isSubmitting || draft.state === "drafting"}
      onClick={() =>
        void draft.draft({
          ticketId: "new",
          shop: form.effectiveShop,
          subject: form.subject,
          category: form.category,
          tone: form.tone,
          instruction: form.instruction,
        })
      }
    >
      <Sparkles className="mr-1.5 size-3.5 text-purple-600 dark:text-purple-400" />
      {draft.state === "drafting" ? "Generating with AI…" : aiActionLabel(form)}
    </Button>
  );
}

function AssistantHeader() {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-purple-600 dark:text-purple-400" />
        <Text as="span" className="text-xs font-semibold text-purple-950 dark:text-purple-200 uppercase tracking-wider">
          AI Writing & Polish Assistant
        </Text>
      </div>
      <Text as="span" className="text-[11px] text-muted-foreground">
        Workers AI
      </Text>
    </div>
  );
}

function AssistantBox({ form, draft, isSubmitting }: Omit<MessageCardProps, "uploads">) {
  return (
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
      <AssistantHeader />
      <Textarea
        id="ai-instruction"
        rows={2}
        value={form.instruction}
        onChange={(e) => form.setInstruction(e.target.value)}
        placeholder="Tell the AI what to write (e.g. 'We investigated the checkout issue and deployed a fix, ask them to test')"
        disabled={draft.state === "drafting"}
        className="bg-background text-sm"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
        <ToneSelect form={form} />
        <DraftButton form={form} draft={draft} isSubmitting={isSubmitting} />
      </div>
      {draft.error && <p className="mt-2 text-xs text-destructive">{draft.error}</p>}
    </div>
  );
}

function BodyField({ form }: { readonly form: NewTicketForm }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label htmlFor="body">Message Body</Label>
        <span className="text-xs text-muted-foreground">{form.bodyText.length}/{BODY_MAX}</span>
      </div>
      <Textarea
        id="body"
        name="body"
        rows={6}
        value={form.bodyText}
        onChange={(e) => form.setBodyText(e.target.value)}
        maxLength={BODY_MAX}
        placeholder="Write your message to the merchant, or use the AI assistant above..."
      />
      <p className="text-xs text-muted-foreground">
        This message will be emailed to the merchant and visible in their embedded support portal.
      </p>
    </div>
  );
}

export function MessageCard({ form, draft, uploads, isSubmitting }: MessageCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Message & Attachments</CardTitle>
        <CardDescription>Write your message or let the AI optimize and draft it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <AssistantBox form={form} draft={draft} isSubmitting={isSubmitting} />
        <BodyField form={form} />
        <div className="space-y-2 pt-2">
          <Label>Attachments</Label>
          <InternalAttachmentPicker uploads={uploads} />
        </div>
      </CardContent>
    </Card>
  );
}
