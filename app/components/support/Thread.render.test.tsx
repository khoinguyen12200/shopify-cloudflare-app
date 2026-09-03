import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Thread } from "./Thread";

describe("Thread", () => {
  it("shows a CSV attachment as a labeled downloadable file", () => {
    const html = renderToStaticMarkup(
      <Thread
        downloadLabel="Download file"
        formatFileSize={(sizeBytes) => `${Math.max(1, Math.round(sizeBytes / 1024))} KB`}
        formatWhen={() => "now"}
        youLabel="You"
        messages={[
          {
            id: "message_1",
            author: "merchant",
            authorName: "Store",
            body: "",
            createdAt: 1,
            attachments: [
              {
                id: "attachment_1",
                filename: "orders.csv",
                contentType: "text/csv",
                sizeBytes: 2048,
                url: "/support/file/attachment_1",
                kind: "file",
              },
            ],
          },
        ]}
      />,
    );

    expect(html).toContain("CSV");
    expect(html).toContain("orders.csv");
    expect(html).toContain("2 KB");
    expect(html).toContain("Download file");
    expect(html).toContain('download="orders.csv"');
  });
});
