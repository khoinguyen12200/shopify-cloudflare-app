import { z } from "zod";

const nonBlankUnpadded = z.string().refine(
  (value) => value.trim().length > 0 && value.trim() === value,
  "Value must be non-blank and unpadded",
);

export const currentAppInstallationSchema: z.ZodType<{
  data: { currentAppInstallation: { app: { handle: string } } };
}> = z.object({
  data: z.object({
    currentAppInstallation: z.object({
      app: z.object({
        handle: nonBlankUnpadded,
      }),
    }),
  }),
});

export const currentAppInstallationIdentitySchema = z.object({
  data: z.object({
    currentAppInstallation: z.object({
      app: z.object({
        id: z.string().refine((value) => /^gid:\/\/shopify\/App\/[^/]+$/.test(value), "App ID must use the Shopify App GID namespace"),
        apiKey: nonBlankUnpadded,
        handle: nonBlankUnpadded,
      }),
    }),
  }),
});
