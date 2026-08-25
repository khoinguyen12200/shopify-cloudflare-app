import { describe, it, expect } from "vitest";
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  attachmentKey,
  safeFilename,
  validateUpload,
} from "./attachment";

describe("validateUpload", () => {
  it("accepts the common image types merchants actually paste", () => {
    for (const type of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      const result = validateUpload({ contentType: type, sizeBytes: 1024 });
      expect(result.ok, type).toBe(true);
      if (result.ok) expect(result.value.kind).toBe("image");
    }
  });

  it("accepts video, which is the whole point of screen recordings", () => {
    for (const type of ["video/mp4", "video/webm", "video/quicktime"]) {
      const result = validateUpload({ contentType: type, sizeBytes: 5_000_000 });
      expect(result.ok, type).toBe(true);
      if (result.ok) expect(result.value.kind).toBe("video");
    }
  });

  it("ignores charset and casing on the content type", () => {
    // Browsers send `video/MP4` and occasionally a parameter.
    const result = validateUpload({
      contentType: "VIDEO/MP4; codecs=avc1",
      sizeBytes: 10,
    });
    expect(result.ok).toBe(true);
  });

  it("refuses anything that is not an image or a video", () => {
    for (const type of ["application/pdf", "text/html", "application/zip", ""]) {
      const result = validateUpload({ contentType: type, sizeBytes: 10 });
      expect(result.ok, type).toBe(false);
      if (!result.ok) expect(result.reason).toBe("unsupported_type");
    }
  });

  it("refuses an executable dressed as a long image name", () => {
    // The content type is what is enforced; the filename is never trusted.
    const result = validateUpload({
      contentType: "application/x-msdownload",
      sizeBytes: 10,
    });
    expect(result.ok).toBe(false);
  });

  it("refuses an empty file", () => {
    const result = validateUpload({ contentType: "image/png", sizeBytes: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("empty");
  });

  it("caps images at the image limit", () => {
    expect(validateUpload({ contentType: "image/png", sizeBytes: IMAGE_MAX_BYTES }).ok).toBe(true);
    const over = validateUpload({
      contentType: "image/png",
      sizeBytes: IMAGE_MAX_BYTES + 1,
    });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toBe("too_large");
  });

  it("caps videos at the larger video limit, not the image one", () => {
    // A screen recording is legitimately bigger than a screenshot; sharing one
    // cap would either block video or let a 100 MB PNG through.
    expect(validateUpload({ contentType: "video/mp4", sizeBytes: IMAGE_MAX_BYTES + 1 }).ok).toBe(true);
    expect(validateUpload({ contentType: "video/mp4", sizeBytes: VIDEO_MAX_BYTES }).ok).toBe(true);
    expect(validateUpload({ contentType: "video/mp4", sizeBytes: VIDEO_MAX_BYTES + 1 }).ok).toBe(false);
  });

  it("gives video a bigger allowance than images", () => {
    expect(VIDEO_MAX_BYTES).toBeGreaterThan(IMAGE_MAX_BYTES);
  });
});

describe("safeFilename", () => {
  it("keeps an ordinary name intact", () => {
    expect(safeFilename("screenshot 2026-08-25.png")).toBe("screenshot 2026-08-25.png");
  });

  it("strips any path, so an upload cannot name a directory", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\me\\shot.png")).toBe("shot.png");
  });

  it("strips control characters and quotes that would break a header", () => {
    // This value ends up in a Content-Disposition header on download.
    expect(safeFilename('a"b\r\nc.png')).toBe("abc.png");
  });

  it("truncates a very long name but keeps its extension", () => {
    const name = `${"a".repeat(300)}.png`;
    const safe = safeFilename(name);
    expect(safe.length).toBeLessThanOrEqual(100);
    expect(safe.endsWith(".png")).toBe(true);
  });

  it("falls back to a placeholder when nothing usable is left", () => {
    expect(safeFilename("///")).toBe("file");
    expect(safeFilename("")).toBe("file");
  });
});

describe("attachmentKey", () => {
  it("scopes the object by shop and ticket, and never trusts the filename", () => {
    const key = attachmentKey({
      shop: "demo.myshopify.com",
      ticketId: "tkt_1",
      uploadId: "up_2",
    });
    // Shop-first so a prefix listing is a tenant boundary, per @rules/data.md.
    expect(key).toBe("support/demo.myshopify.com/tkt_1/up_2");
  });

  it("produces a distinct key per upload", () => {
    const base = { shop: "s.myshopify.com", ticketId: "t" };
    expect(attachmentKey({ ...base, uploadId: "a" })).not.toBe(
      attachmentKey({ ...base, uploadId: "b" }),
    );
  });
});
