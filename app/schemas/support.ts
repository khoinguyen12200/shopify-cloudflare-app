import { z } from "zod";
import { SUPPORT_CATEGORIES } from "~/support/categories";

/**
 * At most this many CC addresses on a ticket. Every one becomes an outbound
 * send on every reply, so the cap is a bill and a reputation control, not a
 * style preference.
 */
export const CC_MAX = 5;

export const SUBJECT_MAX = 200;
export const BODY_MAX = 5000;

/** Anything that people actually type or paste between addresses. */
const CC_SEPARATORS = /[,;\n]/;

/**
 * A CC field: free text in, a clean deduped list out.
 *
 * Deduping happens BEFORE the cap is checked — pasting the same address twice
 * is a typo, not an attempt to exceed the limit, and failing it would be
 * baffling.
 */
export const ccEmailsSchema = z
  .string()
  .optional()
  .default("")
  .transform((raw) =>
    Array.from(
      new Set(
        raw
          .split(CC_SEPARATORS)
          .map((entry) => entry.trim().toLowerCase())
          .filter((entry) => entry.length > 0),
      ),
    ),
  )
  .pipe(z.array(z.string().email()).max(CC_MAX));

/**
 * An optional reply address. Blank means "none" rather than invalid: the field
 * is prefilled from Shopify but the merchant may clear it, and an empty string
 * must not fail the form.
 */
const optionalEmail = z
  .string()
  .optional()
  .transform((raw) => raw?.trim().toLowerCase() ?? "")
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || z.string().email().safeParse(value).success, {
    message: "Enter a valid email address",
  });

/** Trimmed, and required to have content once trimmed — " " is not a subject. */
const requiredText = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1).max(max));

/** Comma-separated upload ids handed back by the streaming upload route. */
const uploadIdsSchema = z
  .string()
  .optional()
  .default("")
  .transform((raw) =>
    raw
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  );

export const createTicketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  subject: requiredText(SUBJECT_MAX),
  body: requiredText(BODY_MAX),
  merchantEmail: optionalEmail,
  ccEmails: ccEmailsSchema,
  uploadIds: uploadIdsSchema,
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/**
 * A reply. Either a body or an attachment is enough on its own — a screenshot
 * with no words is a perfectly good answer to "can you show me?".
 */
export const replySchema = z
  .object({
    body: z
      .string()
      .optional()
      .default("")
      .transform((value) => value.trim())
      .pipe(z.string().max(BODY_MAX)),
    uploadIds: uploadIdsSchema,
  })
  .refine((value) => value.body.length > 0 || value.uploadIds.length > 0, {
    message: "Write a message or attach a file",
  });

export type ReplyInput = z.infer<typeof replySchema>;

/** Editing the CC list on an existing ticket. */
export const updateCcSchema = z.object({ ccEmails: ccEmailsSchema });
