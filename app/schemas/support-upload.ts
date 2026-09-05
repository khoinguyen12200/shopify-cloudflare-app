import { z } from "zod";

type StoredUpload = {
  uploadId: string;
  r2Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export const storedUploadSchema: z.ZodType<StoredUpload> = z.object({
  uploadId: z.string().min(1),
  r2Key: z.string().min(1),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
});

export type { StoredUpload };
