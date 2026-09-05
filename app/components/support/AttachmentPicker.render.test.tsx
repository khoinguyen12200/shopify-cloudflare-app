import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AttachmentPicker } from "./AttachmentPicker";

describe("AttachmentPicker", () => {
  it("renders the passed upload state and invokes controller callbacks", async () => {
    const add = vi.fn(async () => undefined);
    const remove = vi.fn();
    render(
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
    expect(screen.getByRole("img", { name: "shot.png" })).toBeTruthy();
    const input = document.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement)) throw new Error("Attachment file input missing");
    const file = new File(["abc"], "new.png", { type: "image/png" });
    await fireEvent.change(input, { target: { files: [file] } });
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ 0: file, length: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Remove shot.png" }));
    expect(remove).toHaveBeenCalledWith("up_1");
  });
});
