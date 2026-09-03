import { useRef } from "react";
import { Button, Text } from "ngk-dashboard";
import type { UploadState } from "./AttachmentPicker";

/** The internal console uses ngk-dashboard, not Shopify Polaris web components. */
export function InternalAttachmentPicker({ uploads }: { uploads: UploadState }) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        accept="image/*,video/*,.csv,.txt,.md,.json,.xml,.pdf,.zip,.gz,.xls,.xlsx,.doc,.docx"
        multiple
        hidden
        onChange={(event) => {
          void uploads.add(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />
      <input type="hidden" name="uploadIds" value={uploads.files.map((file) => file.uploadId).join(",")} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" disabled={uploads.busy} onClick={() => input.current?.click()}>
          {uploads.busy ? "Uploading..." : "Attach files"}
        </Button>
        <Text as="span" className="text-xs text-muted-foreground">
          Up to 10 MB images, 100 MB video, and 25 MB files
        </Text>
      </div>

      {uploads.files.map((file) => (
        <div key={file.uploadId} className="flex items-center gap-2 text-sm">
          <input
            type="hidden"
            name={`upload:${file.uploadId}`}
            value={`${file.r2Key}|${file.filename}|${file.contentType}|${file.sizeBytes}`}
          />
          <Text as="span" className="max-w-80 truncate">{file.filename}</Text>
          <Button type="button" variant="ghost" size="sm" onClick={() => uploads.remove(file.uploadId)}>
            Remove
          </Button>
        </div>
      ))}

      {uploads.error && <Text as="p" className="text-sm text-destructive">That file could not be uploaded. Try again.</Text>}
    </div>
  );
}
