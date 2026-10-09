import { useState } from "react";
import { Form, useNavigation } from "react-router";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
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
import { usePendingUploads } from "~/routes/app/support/use-pending-uploads";
import { useReplyDraft } from "~/internal/use-reply-draft";
import { DEFAULT_TONE, REPLY_TONES, TONE_LABEL, toReplyTone, type ReplyTone } from "~/ai/tones";

type ReplyDraft = ReturnType<typeof useReplyDraft>;

interface AiBoxProps {
  readonly ticketId: string;
  readonly draft: ReplyDraft;
  readonly busy: boolean;
}

/*
 * The label names the job, so nobody has to guess what pressing it will do to
 * text they have already written. Same three modes the prompt builder picks
 * between — read from the same two inputs, so they cannot disagree.
 */
function aiActionCopy(instruction: string): { label: string; hint: string } {
  if (instruction.trim() !== "") {
    return { label: "Write reply", hint: "Replaces the reply below" };
  }
  return {
    label: "Improve reply",
    hint: "Rewrites what is in the reply below, or suggests one if it is empty",
  };
}

function ToneSelect({ tone, onChange }: { readonly tone: ReplyTone; readonly onChange: (tone: ReplyTone) => void }) {
  return (
    <Select value={tone} onValueChange={(next) => onChange(toReplyTone(next))}>
      <SelectTrigger className="w-40" aria-label="Tone">
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
  );
}

/**
 * The AI box is SEPARATE from the reply box on purpose. What goes here is
 * shorthand — "fix ships friday, say sorry" — and the reply is what comes back.
 * Typing notes into the field that gets emailed and hoping to remember to
 * overwrite them is how a note reaches a merchant.
 *
 * Empty, it falls back to the reply box: polish what is there, or suggest one
 * from the thread. The button says which.
 */
function AiBox({ ticketId, draft, busy }: AiBoxProps) {
  const [tone, setTone] = useState<ReplyTone>(DEFAULT_TONE);
  const [instruction, setInstruction] = useState("");
  const copy = aiActionCopy(instruction);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <Label htmlFor="ai-instruction" className="text-xs text-muted-foreground">
        Tell the AI what to say — it writes the reply below
      </Label>
      <Textarea
        id="ai-instruction"
        rows={2}
        value={instruction}
        onChange={(event) => setInstruction(event.currentTarget.value)}
        placeholder="fix ships friday, apologise for the delay"
        disabled={draft.state === "drafting"}
      />
      <div className="flex flex-wrap items-center gap-2">
        <ToneSelect tone={tone} onChange={setTone} />
        <Button
          type="button"
          variant="outline"
          disabled={busy || draft.state === "drafting"}
          onClick={() => void draft.draft({ ticketId, tone, instruction })}
        >
          <Sparkles className="mr-1 size-4" />
          {draft.state === "drafting" ? "Writing…" : copy.label}
        </Button>
        <Text as="span" className="text-xs text-muted-foreground">
          {copy.hint}
        </Text>
      </div>
    </div>
  );
}

function ReplyActions({ isClosed, busy, pendingIntent }: { readonly isClosed: boolean; readonly busy: boolean; readonly pendingIntent: unknown }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="submit" disabled={busy}>
        {busy && !pendingIntent ? "Sending…" : "Send reply"}
      </Button>
      {!isClosed && (
        <Button type="submit" name="intent" value="close" variant="outline" disabled={busy}>
          Close ticket
        </Button>
      )}
    </div>
  );
}

export function ReplyCard({ ticketId, isClosed }: { readonly ticketId: string; readonly isClosed: boolean }) {
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  // Targets the composer's textarea by id and rewrites what is in it.
  const draft = useReplyDraft("body");
  const uploads = usePendingUploads(ticketId);

  return (
    <Card>
      <CardHeader>
        <Text as="h2" className="font-semibold">
          {isClosed ? "Reopen with a reply" : "Reply"}
        </Text>
      </CardHeader>
      <CardContent>
        <Form method="post" className="flex flex-col gap-3">
          <AiBox ticketId={ticketId} draft={draft} busy={busy} />

          <Label htmlFor="body" className="sr-only">
            Reply
          </Label>
          <Textarea
            id="body"
            name="body"
            rows={5}
            maxLength={BODY_MAX}
            placeholder="This reply is emailed to the merchant and their copy list."
          />

          <InternalAttachmentPicker uploads={uploads} />

          <ReplyActions isClosed={isClosed} busy={busy} pendingIntent={pendingIntent} />

          {draft.error && (
            <Text as="p" className="text-sm text-destructive">
              {draft.error}
            </Text>
          )}
        </Form>
      </CardContent>
    </Card>
  );
}
