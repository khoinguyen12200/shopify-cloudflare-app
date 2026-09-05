import { describe, expect, it } from "vitest";
import { storedUploadSchema } from "./support-upload";

describe("storedUploadSchema", () => {
  it("accepts the complete upload response returned by the streaming route", () => {
    expect(
      storedUploadSchema.safeParse({
        uploadId: "up_1",
        r2Key: "support/shop/ticket/up_1",
        filename: "shot.png",
        contentType: "image/png",
        sizeBytes: 3,
      }).success,
    ).toBe(true);
  });

  it("rejects malformed upload responses", () => {
    expect(
      storedUploadSchema.safeParse({
        uploadId: "up_1",
        r2Key: "support/shop/ticket/up_1",
        filename: "shot.png",
        contentType: "image/png",
      }).success,
    ).toBe(false);
  });
});
