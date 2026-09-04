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

export function usePendingUploads(ticketId?: string): UploadController {
  const [files, setFiles] = useState<PendingUpload[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = useCallback(async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(picked)) {
        const check = validateUpload({ contentType: file.type, sizeBytes: file.size });
        if (!check.ok) {
          setError(check.reason);
          continue;
        }
        const response = await fetch("/support/upload", {
          method: "POST",
          body: file,
          headers: {
            "Content-Type": file.type,
            "X-Support-Filename": encodeURIComponent(file.name),
            ...(ticketId ? { "X-Support-Ticket": ticketId } : {}),
          },
        });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          const reason = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "upload_failed";
          setError(reason);
          continue;
        }
        const parsed = storedUploadSchema.safeParse(await response.json().catch(() => null));
        if (!parsed.success) {
          setError("upload_failed");
          continue;
        }
        setFiles((current) => {
          if (current.length >= MAX_FILES) return current;
          const previewUrl = URL.createObjectURL(file);
          return [...current, { ...parsed.data, previewUrl, kind: check.value.kind }];
        });
      }
    } finally {
      setBusy(false);
    }
  }, [ticketId]);

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
