import { describe, expect, it } from "vitest";
import { parseInlineAttachments, readJsonObject } from "./json-body";

const request = (body: string) => new Request("https://app.test", { method: "POST", body });

describe("readJsonObject", () => {
  it("returns an object body", async () => {
    expect(await readJsonObject(request('{"a":1}'))).toEqual({ a: 1 });
  });
  it("refuses malformed JSON and non-object JSON", async () => {
    expect(await readJsonObject(request("{oops"))).toBeUndefined();
    expect(await readJsonObject(request("[1]"))).toBeUndefined();
    expect(await readJsonObject(request("null"))).toBeUndefined();
    expect(await readJsonObject(request('"text"'))).toBeUndefined();
  });
});

describe("parseInlineAttachments", () => {
  it("keeps well-formed entries and drops the rest", () => {
    const good = { filename: "a.png", contentType: "image/png", contentBase64: "AAA=" };
    expect(parseInlineAttachments([good, { filename: "x" }, null, 3, { ...good, contentBase64: 1 }])).toEqual([good]);
  });
  it("treats a non-array as none", () => {
    expect(parseInlineAttachments(undefined)).toEqual([]);
    expect(parseInlineAttachments({})).toEqual([]);
  });
});
