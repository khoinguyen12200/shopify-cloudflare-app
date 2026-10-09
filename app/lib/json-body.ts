import { z } from "zod";

const jsonObject = z.record(z.string(), z.unknown());

const inlineAttachment = z.object({
  filename: z.string(),
  contentType: z.string(),
  contentBase64: z.string(),
});

export type InlineAttachment = z.infer<typeof inlineAttachment>;

/**
 * The request body as a JSON OBJECT, or `undefined` when it is not valid JSON or
 * not an object (an array, a string and `null` are all valid JSON but not a body
 * any of these endpoints accepts). The caller answers 400.
 */
export async function readJsonObject(
  request: { json(): Promise<unknown> },
): Promise<Record<string, unknown> | undefined> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return undefined;
  }
  const parsed = jsonObject.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** Inline attachments from a JSON body: well-formed entries kept, anything else dropped. */
export function parseInlineAttachments(value: unknown): InlineAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = inlineAttachment.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}
