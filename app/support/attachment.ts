import { err, ok, type Result } from "~/lib/result";

/**
 * What a merchant may attach to a support message, and how big.
 *
 * The allowlist is on the CONTENT TYPE, never the filename: a filename is
 * attacker-chosen text that happens to be displayed, and `.png` on the end of
 * an executable proves nothing.
 */
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

/** mp4/webm cover every browser recorder; quicktime is what macOS and iOS produce. */
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

const FILE_TYPES = [
  "text/csv",
  "text/plain",
  "text/markdown",
  "text/xml",
  "application/json",
  "application/pdf",
  "application/zip",
  "application/gzip",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** A screenshot. Generous enough for a retina full-page grab. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * A screen recording. Deliberately much larger than an image: "record what
 * happens" is the single most useful thing in a bug report, and a shared cap
 * would either block video or let a 100 MB PNG through. Enforced while
 * STREAMING to R2, so the ceiling costs no isolate memory.
 */
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;

/** Diagnostic exports and documents can be substantial, but never recording-sized. */
export const FILE_MAX_BYTES = 25 * 1024 * 1024;

export type AttachmentKind = "image" | "video" | "file";

export type UploadRejection = "unsupported_type" | "too_large" | "empty";

/** Longest filename kept. Long enough to stay recognisable, short enough for a cell. */
const FILENAME_MAX = 100;

function kindOf(contentType: string): AttachmentKind | null {
  // Browsers send `video/MP4` and sometimes append parameters.
  const type = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if ((IMAGE_TYPES as readonly string[]).includes(type)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(type)) return "video";
  if ((FILE_TYPES as readonly string[]).includes(type)) return "file";
  return null;
}

/**
 * Whether this upload is allowed, and which limit applies to it.
 *
 * Pure: the caller supplies the declared type and size, so every branch is
 * testable without a request or a bucket.
 */
export function validateUpload(upload: {
  readonly contentType: string;
  readonly sizeBytes: number;
}): Result<{ kind: AttachmentKind; maxBytes: number }, UploadRejection> {
  const kind = kindOf(upload.contentType);
  if (!kind) return err("unsupported_type", upload.contentType);
  if (upload.sizeBytes <= 0) return err("empty");

  const maxBytes = kind === "video" ? VIDEO_MAX_BYTES : kind === "file" ? FILE_MAX_BYTES : IMAGE_MAX_BYTES;
  if (upload.sizeBytes > maxBytes) {
    return err("too_large", `${upload.sizeBytes} > ${maxBytes}`);
  }
  return ok({ kind, maxBytes });
}

/** Every character allowed to survive into a stored, displayed, downloaded name. */
const UNSAFE_FILENAME = /[^A-Za-z0-9 ._-]/g;

/**
 * A filename safe to store, render, and put in a `Content-Disposition` header.
 *
 * Drops any directory component, so an upload can never describe a path, and
 * removes quotes and control characters, which would otherwise let a filename
 * break out of the header it is written into.
 */
export function safeFilename(raw: string): string {
  // Both separators: the client OS is not ours to assume.
  const base = raw.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(UNSAFE_FILENAME, "").trim();
  if (cleaned === "" || cleaned === "." || cleaned === "..") return "file";
  if (cleaned.length <= FILENAME_MAX) return cleaned;

  // Truncate the stem, keep the extension — a name without one is unopenable.
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, Math.max(1, FILENAME_MAX - ext.length)) + ext;
}

/**
 * The R2 key for an attachment.
 *
 * Shop first, so a key prefix is a tenant boundary and a shop purge is a prefix
 * listing rather than a join (@rules/data.md). The upload id — not the
 * filename — makes it unique, so two merchants uploading `screenshot.png`
 * cannot collide and a guessed name reaches nothing.
 */
export function attachmentKey(parts: {
  readonly shop: string;
  readonly ticketId: string;
  readonly uploadId: string;
}): string {
  return `support/${parts.shop}/${parts.ticketId}/${parts.uploadId}`;
}
