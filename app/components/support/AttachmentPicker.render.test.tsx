import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AttachmentPicker } from "./AttachmentPicker";

describe("AttachmentPicker", () => {
  it("renders the passed upload state without owning upload behavior", () => {
    const add = vi.fn(async () => undefined);
    const remove = vi.fn();
    const html = renderToStaticMarkup(
      <AttachmentPicker
        label="Attachments"
        addLabel="Add files"
        limitsLabel="Limits"
        uploads={{
          files: [{ uploadId: "up_1", r2Key: "key", filename: "shot.png", contentType: "image/png", sizeBytes: 2048, previewUrl: "blob:shot", kind: "image" }],
          busy: false,
          error: null,
          add,
          remove,
          reset: vi.fn(),
        }}
      />,
    );
    expect(html).toContain("shot.png");
    expect(html).toContain('value="up_1"');
    expect(AttachmentPicker.toString()).not.toContain("fetch");
  });
});
