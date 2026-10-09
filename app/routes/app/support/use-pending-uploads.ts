import { useCallback, useEffect, useState } from "react";
import { storedUploadSchema } from "~/schemas/support-upload";
import { validateUpload, type AttachmentKind } from "~/support/attachment";

export interface PendingUpload {
  readonly uploadId: string;
  readonly r2Key: string;
  readonly filename: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly previewUrl: string;
  readonly kind: AttachmentKind;
}

export interface UploadController {
  readonly files: readonly PendingUpload[];
  readonly busy: boolean;
  readonly error: string | null;
  add(files: FileList | null): Promise<void>;
  remove(uploadId: string): void;
  reset(): void;
}

const MAX_FILES = 10;

type StoredUpload = NonNullable<ReturnType<typeof parseStored>>;

function parseStored(payload: unknown) {
  const parsed = storedUploadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** The server's reason for refusing an upload, or a generic one. */
async function failureReason(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : "upload_failed";
}

type UploadOutcome =
  | { readonly ok: true; readonly stored: StoredUpload }
  | { readonly ok: false; readonly reason: string };

/** Streams one file to the upload route; never throws. */
async function uploadFile(file: File, ticketId?: string, shop?: string): Promise<UploadOutcome> {
  let response: Response;
  try {
    response = await fetch("/support/upload", {
      method: "POST",
      body: file,
      headers: {
        "Content-Type": file.type,
        "X-Support-Filename": encodeURIComponent(file.name),
        ...(ticketId ? { "X-Support-Ticket": ticketId } : {}),
        ...(shop ? { "X-Shop": shop } : {}),
      },
    });
  } catch {
    return { ok: false, reason: "upload_failed" };
  }
  if (!response.ok) return { ok: false, reason: await failureReason(response) };
  const stored = parseStored(await response.json().catch(() => null));
  return stored ? { ok: true, stored } : { ok: false, reason: "upload_failed" };
}

export function usePendingUploads(ticketId?: string, shop?: string): UploadController {
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      let remaining = Math.max(0, MAX_FILES - files.length);
      for (const file of Array.from(picked)) {
        const check = validateUpload({ contentType: file.type, sizeBytes: file.size });
        if (!check.ok) {
          setError(check.reason);
          continue;
        }
        if (remaining === 0) break;
        remaining -= 1;
        const outcome = await uploadFile(file, ticketId, shop);
        if (!outcome.ok) {
          setError(outcome.reason);
          continue;
        }
        setFiles((current) => {
          if (current.length >= MAX_FILES) return current;
          const previewUrl = URL.createObjectURL(file);
          return [...current, { ...outcome.stored, previewUrl, kind: check.value.kind }];
        });
      }
    } finally {
      setBusy(false);
    }
  }, [files.length, ticketId, shop]);

  const remove = useCallback((uploadId: string) => {
    setFiles((current) => {
      const target = current.find((file) => file.uploadId === uploadId);
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

  useEffect(() => reset, [reset]);
  return { files, busy, error, add, remove, reset };
}
