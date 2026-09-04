import { useCallback, useRef, useState } from "react";
import { validateUpload } from "~/support/attachment";

/**
 * One file already streamed into R2 and waiting to be adopted by a message.
 *
 * `previewUrl` is a local object URL, never the stored object: the file is
 * already in the browser, so previewing it costs no round trip and works before
 * the row exists.
 */
export interface PendingUpload {
  uploadId: string;
  r2Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  previewUrl: string;
  kind: "image" | "video" | "file";
}

export interface UploadState {
  files: PendingUpload[];
  busy: boolean;
  error: string | null;
  add(files: FileList | null): Promise<void>;
  remove(uploadId: string): void;
  reset(): void;
}

/** Most files one message may carry. Beyond this it is a file share, not a report. */
const MAX_FILES = 10;

/**
 * Uploads each picked file to `/support/upload`, one request per file.
 *
 * The fetch here is a client INTERACTION, not server data loading — the same
 * category as submitting a form — so it does not belong in a loader and does
 * not conflict with the "components do not fetch" rule. It cannot be a loader:
 * a 100 MB video has to stream as its own request body (see the upload route).
 *
 * Each file goes up on its own so one rejected file does not lose the others,
 * and so a failure names the file that failed.
 */
export function usePendingUploads(ticketId?: string): UploadState {
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(
    async (picked: FileList | null) => {
      if (!picked || picked.length === 0) return;
      setError(null);
      setBusy(true);

      try {
        for (const file of Array.from(picked)) {
          // Checked in the browser first, with the SAME pure function the
          // server uses, so an oversized video fails instantly instead of
          // after a long upload. The server still re-checks — this is a
          // courtesy, never the enforcement.
          const check = validateUpload({
            contentType: file.type,
            sizeBytes: file.size,
          });
          if (!check.ok) {
            setError(check.reason);
            continue;
          }

          const response = await fetch("/support/upload", {
            method: "POST",
            // Raw body, not multipart: the route streams it straight to R2.
            body: file,
            headers: {
              "Content-Type": file.type,
              "X-Support-Filename": encodeURIComponent(file.name),
              ...(ticketId ? { "X-Support-Ticket": ticketId } : {}),
            },
          });

          if (!response.ok) {
            const body: unknown = await response.json().catch(() => null);
            const reason =
              body && typeof body === "object" && "error" in body
                ? String((body as { error: unknown }).error)
                : "upload_failed";
            setError(reason);
            continue;
          }

          const stored = (await response.json()) as {
            uploadId: string;
            r2Key: string;
            filename: string;
            contentType: string;
            sizeBytes: number;
          };

          setFiles((current) =>
            current.length >= MAX_FILES
              ? current
              : [
                  ...current,
                  {
                    ...stored,
                    previewUrl: URL.createObjectURL(file),
                    kind: check.value.kind,
                  },
                ],
          );
        }
      } finally {
        setBusy(false);
      }
    },
    [ticketId],
  );

  const remove = useCallback((uploadId: string) => {
    setFiles((current) => {
      const target = current.find((file) => file.uploadId === uploadId);
      // Release the blob so a long composing session does not leak memory.
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((file) => file.uploadId !== uploadId);
    });
  }, []);

  const reset = useCallback(() => {
    setFiles((current) => {
      for (const file of current) URL.revokeObjectURL(file.previewUrl);
      return [];
    });
  }, []);

  return { files, busy, error, add, remove, reset };
}

const PICKER_CSS = `
.sup-files { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.sup-file {
  position: relative;
  inline-size: 5.5rem;
  block-size: 5.5rem;
  border-radius: 10px;
  overflow: hidden;
  background: rgba(128,128,128,0.12);
}
.sup-file img, .sup-file video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  display: block;
}
.sup-file--document { display: flex; flex-direction: column; justify-content: center; gap: 0.25rem; padding: 0.5rem; }
.sup-file__icon { font-size: 0.7rem; font-weight: 750; letter-spacing: 0.04em; }
.sup-file__name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.6875rem; }
.sup-file__remove {
  position: absolute;
  inset-block-start: 3px;
  inset-inline-end: 3px;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  border: 0;
  border-radius: 999px;
  background: rgba(0,0,0,0.62);
  color: #fff;
  font-size: 0.8125rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.sup-file__badge {
  position: absolute;
  inset-block-end: 3px;
  inset-inline-start: 3px;
  padding: 0 0.25rem;
  border-radius: 4px;
  background: rgba(0,0,0,0.62);
  color: #fff;
  font-size: 0.625rem;
  letter-spacing: 0.02em;
}
`;

/**
 * The picker: a button, a hidden file input, and a grid of what is staged.
 *
 * Emits the hidden fields the action reads — the ids, plus one metadata field
 * per upload. The metadata travels with the form rather than being re-fetched
 * server-side because the row does not exist yet and the object is only
 * identified by what the upload route returned.
 */
export function AttachmentPicker({
  label,
  addLabel,
  uploads,
  errorLabel,
  limitsLabel,
}: {
  label: string;
  addLabel: string;
  uploads: UploadState;
  errorLabel?: (reason: string) => string;
  limitsLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <s-stack direction="block" gap="small-300">
      <style dangerouslySetInnerHTML={{ __html: PICKER_CSS }} />
      <s-text>{label}</s-text>

      {uploads.files.length > 0 && (
        <div className="sup-files">
          {uploads.files.map((file) => (
            <div key={file.uploadId} className="sup-file">
              {file.kind === "file" ? (
                <div className="sup-file--document" title={file.filename}>
                  <span className="sup-file__icon">{fileExtensionLabel(file.filename)}</span>
                  <span className="sup-file__name">{file.filename}</span>
                </div>
              ) : file.kind === "video" ? (
                <video src={file.previewUrl} muted playsInline preload="metadata" />
              ) : (
                <img src={file.previewUrl} alt={file.filename} />
              )}
              <span className="sup-file__badge">
                {file.kind === "video" ? "VIDEO" : `${Math.max(1, Math.round(file.sizeBytes / 1024))} KB`}
              </span>
              <button
                type="button"
                className="sup-file__remove"
                aria-label={`Remove ${file.filename}`}
                onClick={() => uploads.remove(file.uploadId)}
              >
                ×
              </button>
              {/* What the action needs to write the row. */}
            </div>
          ))}
        </div>
      )}

      <input type="hidden" name="uploadIds" value={uploads.files.map((f) => f.uploadId).join(",")} />

      <input
        ref={input}
        type="file"
        accept="image/*,video/*,.csv,.txt,.md,.json,.xml,.pdf,.zip,.gz,.xls,.xlsx,.doc,.docx"
        multiple
        hidden
        onChange={(event) => {
          void uploads.add(event.currentTarget.files);
          // Cleared so picking the same file twice still fires a change.
          event.currentTarget.value = "";
        }}
      />

      <s-stack direction="inline" gap="small" alignItems="center">
        <s-button
          type="button"
          variant="secondary"
          icon="image-add"
          loading={uploads.busy}
          disabled={uploads.files.length >= MAX_FILES}
          onClick={() => input.current?.click()}
        >
          {addLabel}
        </s-button>
        <s-text color="subdued">
          {limitsLabel}
        </s-text>
      </s-stack>

      {uploads.error && (
        <s-text tone="critical">
          {errorLabel ? errorLabel(uploads.error) : uploads.error}
        </s-text>
      )}
    </s-stack>
  );
}

function fileExtensionLabel(filename: string): string {
  const extension = filename.split(".").pop()?.slice(0, 4).toUpperCase();
  return extension || "FILE";
}
