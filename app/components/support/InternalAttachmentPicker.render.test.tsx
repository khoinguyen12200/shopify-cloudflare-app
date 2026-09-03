import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InternalAttachmentPicker } from "./InternalAttachmentPicker";

describe("InternalAttachmentPicker", () => {
  it("renders a native file input and an attach button for the internal console", () => {
    const html = renderToStaticMarkup(
      <InternalAttachmentPicker
        uploads={{
          files: [],
          busy: false,
          error: null,
          add: async () => {},
          remove: () => {},
          reset: () => {},
        }}
      />,
    );

    expect(html).toContain('type="file"');
    expect(html).toContain(">Attach files<");
    expect(html).toContain("<button");
    expect(html).not.toContain("<s-button");
  });
});
